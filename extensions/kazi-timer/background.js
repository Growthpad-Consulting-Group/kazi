const TIMER_KEY = "timer";
const QUEUE_KEY = "completedEntries";
const TOKEN_KEY = "kaziAccessToken";
const TICK_ALARM = "kazi-timer-tick";
const KAZI_URL = "https://kazi.growthpad.africa";
const SHARED_TIMER_URL = `${KAZI_URL}/api/pulse/daily-log/timer`;
const OFFLINE_MESSAGE = "Kazi is unreachable. Try again when you are online.";
let messageQueue = Promise.resolve();

// The timer shape is the same one Kazi stores on the server:
// { id, logDate, task, client, category, startedAt (ISO|null), accumulatedMs,
//   running, source, updatedAt }
// Timers saved by older versions of this extension are converted on read.
function elapsedMs(timer, now = Date.now()) {
  if (!timer) return 0;
  const runningMs =
    timer.running && timer.startedAt ? now - Date.parse(timer.startedAt) : 0;
  return Math.min(
    24 * 60 * 60 * 1000,
    Math.max(0, timer.accumulatedMs + runningMs),
  );
}

function elapsedSeconds(timer, now = Date.now()) {
  return Math.floor(elapsedMs(timer, now) / 1000);
}

function normalizeTimer(raw, now = Date.now()) {
  if (!raw) return null;
  if (raw.accumulatedMs !== undefined) return raw;
  const startedAt = new Date(raw.startedAt ?? now).toISOString();
  return {
    id: crypto.randomUUID(),
    logDate: localDate(startedAt),
    task: raw.task,
    client: raw.client || null,
    category: raw.category || "Projects",
    startedAt: raw.running ? startedAt : null,
    accumulatedMs: raw.elapsedMs || 0,
    running: Boolean(raw.running),
    source: raw.source === "kazi" ? "kazi" : "extension",
    updatedAt: new Date(now).toISOString(),
  };
}

async function readTimer() {
  const { [TIMER_KEY]: raw } = await chrome.storage.local.get(TIMER_KEY);
  if (!raw || raw.accumulatedMs !== undefined) return raw ?? null;
  const timer = normalizeTimer(raw);
  await chrome.storage.local.set({ [TIMER_KEY]: timer });
  return timer;
}

// Links to the Asana task a timer was started from, kept only in extension
// storage (never sent to Kazi). The newest few are kept.
async function rememberTimerSource(timerId, url) {
  const { timerSources = {} } = await chrome.storage.local.get("timerSources");
  const entries = Object.entries({ ...timerSources, [timerId]: url }).slice(-5);
  await chrome.storage.local.set({ timerSources: Object.fromEntries(entries) });
}

async function writeTimer(timer) {
  await chrome.storage.local.set({ [TIMER_KEY]: timer });
}

function badgeText(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h`;
  return `${minutes}m`;
}

async function refreshBadge() {
  const timer = await readTimer();
  const seconds = elapsedSeconds(timer);
  await chrome.action.setBadgeText({
    text: timer?.running ? badgeText(seconds) : "",
  });
  await chrome.action.setBadgeBackgroundColor({ color: "#f05d23" });
  await chrome.action.setBadgeTextColor({ color: "#ffffff" });
  await chrome.action.setTitle({
    title: timer?.running
      ? `${timer.task} · ${Math.floor(seconds / 60)}m`
      : "Kazi Timer",
  });
}

function localDate(iso) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// The Kazi token lives in session storage only, so it is never written to disk.
// After a browser restart the worker reconnects silently from the Kazi session.
async function tokenValue() {
  const { [TOKEN_KEY]: token } = await chrome.storage.session.get(TOKEN_KEY);
  if (token) return token;
  // Tokens saved by earlier versions in local storage are moved out of it.
  const { [TOKEN_KEY]: legacyToken } =
    await chrome.storage.local.get(TOKEN_KEY);
  if (legacyToken) {
    await chrome.storage.session.set({ [TOKEN_KEY]: legacyToken });
    await chrome.storage.local.remove(TOKEN_KEY);
  }
  return legacyToken;
}

async function pendingStops() {
  const { [QUEUE_KEY]: queued = [] } =
    await chrome.storage.local.get(QUEUE_KEY);
  return queued.filter((item) => item.type === "stop");
}

// Legacy queue items are completed entries without a type. They still sync
// through the entries endpoint, which claims each id once.
async function syncLegacyEntry(queuedEntry, token) {
  const response = await fetch(
    `${KAZI_URL}/api/extensions/kazi-timer/entries`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: queuedEntry.id,
        date: localDate(queuedEntry.stoppedAt),
        entry: {
          task: queuedEntry.task,
          client: queuedEntry.client || null,
          category: queuedEntry.category,
          minutes: Math.max(1, Math.floor(queuedEntry.seconds / 60)),
        },
      }),
    },
  ).catch(() => null);
  return Boolean(response?.ok);
}

// Stops are sent to the shared endpoint. Stop is idempotent per timer id, so a
// retry after a lost response cannot log the time twice.
async function syncStop(item, token) {
  const request = (body) =>
    fetch(SHARED_TIMER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }).catch(() => null);

  let response = await request({
    action: "stop",
    timerId: item.id,
    at: item.at,
  });
  if (response?.status === 404) {
    // Kazi has never seen this timer, so it was started while disconnected.
    // Send it first, then stop it.
    const created = await fetch(SHARED_TIMER_URL, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ timer: item.timer }),
    }).catch(() => null);
    if (created?.status === 409) {
      const body = await readJson(created);
      // Stopped already, so nothing is left to log. Otherwise another timer is
      // running and this one waits in the queue.
      return body?.error === "This timer was already stopped";
    }
    if (!created?.ok) return false;
    response = await request({ action: "stop", timerId: item.id, at: item.at });
  }
  return Boolean(response?.ok);
}

async function syncQueue() {
  const token = await tokenValue();
  const { [QUEUE_KEY]: queued = [] } =
    await chrome.storage.local.get(QUEUE_KEY);
  if (!token || !queued.length) return { synced: 0, queued: queued.length };
  let synced = 0;
  const remaining = [];
  for (const item of queued) {
    const done =
      item.type === "stop"
        ? await syncStop(item, token)
        : await syncLegacyEntry(item, token);
    if (done) synced += 1;
    else remaining.push(item);
  }
  await chrome.storage.local.set({ [QUEUE_KEY]: remaining });
  return { synced, queued: remaining.length };
}

class KaziUnreachable extends Error {}

async function readJson(response) {
  return typeof response?.json === "function"
    ? response.json().catch(() => null)
    : null;
}

async function sharedTimerRequest(method, body) {
  const token = await tokenValue();
  if (!token) return null;
  let response;
  try {
    response = await fetch(SHARED_TIMER_URL, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new KaziUnreachable(OFFLINE_MESSAGE);
  }
  // The token expires after 12 hours. Forget it so the next tick reconnects.
  if (response.status === 401) await chrome.storage.session.remove(TOKEN_KEY);
  return {
    ok: response.ok,
    status: response.status,
    json: await readJson(response),
  };
}

// Kazi is the source of truth when connected. A timer stopped offline stays
// hidden until its queued stop has synced, so it cannot reappear.
async function refreshFromServer() {
  const local = await readTimer();
  if (!(await tokenValue())) return local;
  let response;
  try {
    response = await sharedTimerRequest("GET");
  } catch {
    return local;
  }
  if (!response?.ok) return local;
  const server = response.json?.timer ?? null;
  if (server && (await pendingStops()).some((item) => item.id === server.id))
    return null;
  await writeTimer(server);
  return server;
}

// A timer started while disconnected joins Kazi on connect. If Kazi already
// has another timer, this one is queued as a finished entry so its time is kept.
async function adoptLocalTimer() {
  const local = await readTimer();
  if (!local) return;
  let response;
  try {
    response = await sharedTimerRequest("PUT", { timer: local });
  } catch {
    return;
  }
  if (response?.status !== 409) return;
  const { [QUEUE_KEY]: queued = [] } =
    await chrome.storage.local.get(QUEUE_KEY);
  await chrome.storage.local.set({
    [TIMER_KEY]: null,
    [QUEUE_KEY]: [
      ...queued,
      {
        type: "stop",
        id: local.id,
        timer: local,
        at: new Date().toISOString(),
      },
    ],
  });
}

// interactive: true may show Kazi's sign-in page. interactive: false only
// succeeds when the staff member is already signed in to Kazi in this browser,
// so it can reconnect with no window and no click.
async function connectKazi({ interactive = true } = {}) {
  const redirectUri = chrome.identity.getRedirectURL("kazi");
  const state = crypto.randomUUID();
  const authorizationUrl = new URL(
    `${KAZI_URL}/api/extensions/kazi-timer/authorize`,
  );
  authorizationUrl.search = new URLSearchParams({
    redirect_uri: redirectUri,
    state,
  }).toString();
  const callbackUrl = await chrome.identity.launchWebAuthFlow({
    url: authorizationUrl.href,
    interactive,
  });
  if (!callbackUrl) throw new Error("Kazi connection was cancelled");
  const callback = new URL(callbackUrl);
  const parameters = new URLSearchParams(callback.hash.slice(1));
  if (parameters.get("state") !== state || !parameters.get("access_token"))
    throw new Error("Kazi did not approve this extension connection");
  await chrome.storage.session.set({
    [TOKEN_KEY]: parameters.get("access_token"),
  });
  await chrome.storage.local.set({ disconnectedByUser: false });
  await adoptLocalTimer();
  await refreshFromServer();
  return syncQueue();
}

const SILENT_RETRY_MS = 10 * 60 * 1000;

// Reconnects without a click when the staff member is still signed in to
// Kazi. Retries are spaced out so the tick alarm does not open a hidden window
// every 30 seconds.
async function reconnectSilently({ force = false } = {}) {
  if (await tokenValue()) return false;
  // Respect an explicit Disconnect until the staff member connects again.
  const { disconnectedByUser = false } =
    await chrome.storage.local.get("disconnectedByUser");
  if (disconnectedByUser) return false;
  const { lastSilentAttempt = 0 } =
    await chrome.storage.local.get("lastSilentAttempt");
  if (!force && Date.now() - lastSilentAttempt < SILENT_RETRY_MS) return false;
  await chrome.storage.local.set({ lastSilentAttempt: Date.now() });
  try {
    await connectKazi({ interactive: false });
    return true;
  } catch {
    return false;
  }
}

async function disconnectKazi() {
  const token = await tokenValue();
  if (token) {
    await fetch(`${KAZI_URL}/api/extensions/kazi-timer/entries`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  await chrome.storage.local.remove(TOKEN_KEY);
  await chrome.storage.session.remove(TOKEN_KEY);
  await chrome.storage.local.set({ disconnectedByUser: true });
}

async function getClients() {
  const token = await tokenValue();
  if (!token) return { clients: [] };
  const response = await fetch(
    `${KAZI_URL}/api/extensions/kazi-timer/clients`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  ).catch(() => null);
  if (!response?.ok) return { clients: [] };
  return response.json();
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.create(TICK_ALARM, { periodInMinutes: 0.5 });
  await refreshBadge();
  // Connect straight away so staff do not have to find Connect Kazi.
  if (!(await reconnectSilently({ force: true })))
    await connectKazi({ interactive: true }).catch(() => {});
});

chrome.runtime.onStartup.addListener(async () => {
  await reconnectSilently({ force: true });
  await refreshFromServer();
  await refreshBadge();
  await syncQueue();
});
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === TICK_ALARM) {
    await reconnectSilently();
    await refreshFromServer();
    await refreshBadge();
    await syncQueue();
  }
});
chrome.storage.onChanged.addListener(refreshBadge);

// Floating timer (opt-in). Off by default. Only sites the staff member has
// chosen, and for which Chrome has granted access, get the overlay script.
const MINI_ENABLED_KEY = "miniTimerEnabled";
const MINI_SITES_KEY = "miniTimerSites";
const MINI_SCRIPT = "content/mini-timer.js";
const ASANA_TASK_SCRIPT = "content/asana-task-timer.js";

async function miniTimerState() {
  const { [MINI_ENABLED_KEY]: enabled = false, [MINI_SITES_KEY]: sites = [] } =
    await chrome.storage.local.get([MINI_ENABLED_KEY, MINI_SITES_KEY]);
  return { enabled: enabled === true, sites };
}

async function injectMiniTimer(tabId) {
  await chrome.scripting
    .executeScript({ target: { tabId }, files: [MINI_SCRIPT] })
    .catch(() => {});
}

async function injectAsanaTaskTimer(tabId, url) {
  if (originOf(url) !== "https://app.asana.com") return;
  await chrome.scripting
    .executeScript({ target: { tabId }, files: [ASANA_TASK_SCRIPT] })
    .catch(() => {});
}

async function injectIntoSite(origin) {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs
      .filter((tab) => tab.id && tab.url && originOf(tab.url) === origin)
      .map(async (tab) => {
        if (originOf(tab.url) === "https://app.asana.com") {
          await injectAsanaTaskTimer(tab.id, tab.url);
        } else {
          await injectMiniTimer(tab.id);
        }
      }),
  );
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  const { enabled, sites } = await miniTimerState();
  if (enabled && sites.includes(originOf(tab.url))) {
    if (originOf(tab.url) === "https://app.asana.com") {
      await injectAsanaTaskTimer(tabId, tab.url);
    } else {
      await injectMiniTimer(tabId);
    }
  }
});

async function handleMessage(message) {
  if (message.type === "get-state") {
    const timer = await refreshFromServer();
    const { [QUEUE_KEY]: queued = [] } =
      await chrome.storage.local.get(QUEUE_KEY);
    return {
      timer,
      elapsedSeconds: elapsedSeconds(timer),
      connected: Boolean(await tokenValue()),
      queued: queued.length,
    };
  }

  if (message.type === "connect")
    return { connected: true, ...(await connectKazi()) };

  if (message.type === "get-clients") return getClients();

  if (message.type === "mini-get-state") return miniTimerState();

  if (message.type === "mini-set-enabled") {
    await chrome.storage.local.set({ [MINI_ENABLED_KEY]: message.enabled });
    return miniTimerState();
  }

  if (message.type === "mini-set-site") {
    // The popup requests or removes the Chrome permission. The worker keeps
    // the list and injects the overlay into tabs already open on that site.
    const { sites } = await miniTimerState();
    const next = message.enabled
      ? [...new Set([...sites, message.origin])]
      : sites.filter((origin) => origin !== message.origin);
    await chrome.storage.local.set({ [MINI_SITES_KEY]: next });
    if (message.enabled) await injectIntoSite(message.origin);
    return miniTimerState();
  }

  if (message.type === "disconnect") {
    await disconnectKazi();
    return { connected: false };
  }

  const timer = await readTimer();

  if (message.type === "start") {
    if (timer) return { error: "A timer is already active" };
    const now = new Date().toISOString();
    const next = {
      id: crypto.randomUUID(),
      logDate: localDate(now),
      task: String(message.task || "").trim(),
      client: message.client || null,
      category: message.category,
      startedAt: now,
      accumulatedMs: 0,
      running: true,
      source: "extension",
      updatedAt: now,
    };
    if (await tokenValue()) {
      let response;
      try {
        response = await sharedTimerRequest("PUT", { timer: next });
      } catch (error) {
        return { error: error.message };
      }
      if (!response.ok) {
        if (response.json?.timer) await writeTimer(response.json.timer);
        return { error: response.json?.error || "Could not start the timer" };
      }
    }
    if (originOf(message.sourceUrl) === "https://app.asana.com")
      await rememberTimerSource(next.id, message.sourceUrl);
    await writeTimer(next);
    return { timer: next };
  }

  if (!timer) return { error: "No active timer" };

  if (message.type === "pause" || message.type === "resume") {
    const action = message.type;
    if (!(await tokenValue())) {
      if (timer.source === "kazi")
        return {
          error: "Connect Kazi to control this timer from the toolbar.",
        };
      const now = Date.now();
      const next =
        action === "pause"
          ? {
              ...timer,
              accumulatedMs: elapsedMs(timer, now),
              startedAt: null,
              running: false,
            }
          : {
              ...timer,
              startedAt: new Date(now).toISOString(),
              running: true,
            };
      await writeTimer(next);
      return { timer: next };
    }
    let response;
    try {
      response = await sharedTimerRequest("POST", {
        action,
        timerId: timer.id,
      });
    } catch (error) {
      return { error: error.message };
    }
    if (!response.ok) {
      if (response.status === 404) await writeTimer(null);
      return { error: response.json?.error || "Could not update the timer" };
    }
    await writeTimer(response.json.timer);
    return { timer: response.json.timer };
  }

  if (message.type === "stop") {
    if (timer.source === "kazi" && !(await tokenValue()))
      return { error: "Connect Kazi to control this timer from the toolbar." };
    const stoppedAt = new Date().toISOString();
    const item = {
      type: "stop",
      id: timer.id,
      timer,
      at: stoppedAt,
    };
    const { [QUEUE_KEY]: queued = [] } =
      await chrome.storage.local.get(QUEUE_KEY);
    await chrome.storage.local.set({
      [TIMER_KEY]: null,
      [QUEUE_KEY]: [...queued, item],
    });
    const sync = await syncQueue();
    return {
      entry: {
        id: timer.id,
        task: timer.task,
        seconds: elapsedSeconds(timer, Date.parse(stoppedAt)),
      },
      ...sync,
    };
  }
  return { error: "Unknown Kazi Timer action" };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  messageQueue = messageQueue
    .then(() => handleMessage(message))
    .then(sendResponse)
    .catch((error) => sendResponse({ error: error.message }));
  return true;
});
