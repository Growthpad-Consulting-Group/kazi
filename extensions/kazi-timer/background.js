const TIMER_KEY = "timer";
const QUEUE_KEY = "completedEntries";
const TOKEN_KEY = "kaziAccessToken";
const TICK_ALARM = "kazi-timer-tick";
const KAZI_URL = "https://kazi.growthpad.africa";
let messageQueue = Promise.resolve();

function elapsedSeconds(timer, now = Date.now()) {
  if (!timer) return 0;
  return Math.max(
    0,
    Math.floor(
      (timer.elapsedMs + (timer.running ? now - timer.startedAt : 0)) / 1000,
    ),
  );
}

function badgeText(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  if (!minutes) return "";
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h`;
  return `${minutes}m`;
}

async function refreshBadge() {
  const { [TIMER_KEY]: timer } = await chrome.storage.local.get(TIMER_KEY);
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

async function syncQueue() {
  const { [TOKEN_KEY]: token } = await chrome.storage.session.get(TOKEN_KEY);
  const { [QUEUE_KEY]: queued = [] } =
    await chrome.storage.local.get(QUEUE_KEY);
  if (!token || !queued.length) return { synced: 0, queued: queued.length };
  let synced = 0;
  const remaining = [];
  for (const queuedEntry of queued) {
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
    if (response?.ok) synced += 1;
    else remaining.push(queuedEntry);
  }
  await chrome.storage.local.set({ [QUEUE_KEY]: remaining });
  return { synced, queued: remaining.length };
}

async function sharedTimerRequest(method, token, body) {
  if (!token) return null;
  const response = await fetch(`${KAZI_URL}/api/pulse/daily-log/timer`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }).catch(() => null);
  return response?.ok ? response.json?.() : null;
}

async function refreshSharedTimer() {
  const { [TOKEN_KEY]: token } = await chrome.storage.session.get(TOKEN_KEY);
  const shared = await sharedTimerRequest("GET", token);
  if (shared?.timer)
    await chrome.storage.local.set({ [TIMER_KEY]: shared.timer });
  return shared?.timer ?? null;
}

async function saveSharedTimer(timer) {
  const { [TOKEN_KEY]: token } = await chrome.storage.session.get(TOKEN_KEY);
  if (!token) return;
  await sharedTimerRequest("PUT", token, {
    date: localDate(new Date().toISOString()),
    timer,
  });
}

async function transitionSharedTimer(action, timer) {
  const { [TOKEN_KEY]: token } = await chrome.storage.session.get(TOKEN_KEY);
  if (!token) return;
  await sharedTimerRequest("POST", token, { action, timer });
}

async function clearSharedTimer() {
  const { [TOKEN_KEY]: token } = await chrome.storage.session.get(TOKEN_KEY);
  if (token) await sharedTimerRequest("DELETE", token);
}

async function connectKazi() {
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
    interactive: true,
  });
  if (!callbackUrl) throw new Error("Kazi connection was cancelled");
  const callback = new URL(callbackUrl);
  const parameters = new URLSearchParams(callback.hash.slice(1));
  if (parameters.get("state") !== state || !parameters.get("access_token"))
    throw new Error("Kazi did not approve this extension connection");
  await chrome.storage.session.set({
    [TOKEN_KEY]: parameters.get("access_token"),
  });
  return syncQueue();
}

async function disconnectKazi() {
  const { [TOKEN_KEY]: token } = await chrome.storage.session.get(TOKEN_KEY);
  if (token) {
    await fetch(`${KAZI_URL}/api/extensions/kazi-timer/entries`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  await chrome.storage.session.remove(TOKEN_KEY);
}

async function getClients() {
  const { [TOKEN_KEY]: token } = await chrome.storage.session.get(TOKEN_KEY);
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
  await chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 });
  await refreshBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await refreshSharedTimer();
  await refreshBadge();
  await syncQueue();
});
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === TICK_ALARM) {
    await refreshSharedTimer();
    await refreshBadge();
    await syncQueue();
  }
});
chrome.storage.onChanged.addListener(refreshBadge);

async function handleMessage(message) {
  const { [TIMER_KEY]: timer } = await chrome.storage.local.get(TIMER_KEY);

  if (message.type === "kazi-page-timer") {
    if (message.timer) {
      await chrome.storage.local.set({ [TIMER_KEY]: message.timer });
    } else if (timer?.source === "kazi") {
      await chrome.storage.local.set({ [TIMER_KEY]: null });
    }
    await refreshBadge();
    return { ok: true };
  }

  if (message.type === "get-state") {
    await refreshSharedTimer();
    const { [TIMER_KEY]: refreshedTimer } =
      await chrome.storage.local.get(TIMER_KEY);
    const { [TOKEN_KEY]: token } = await chrome.storage.session.get(TOKEN_KEY);
    const { [QUEUE_KEY]: queued = [] } =
      await chrome.storage.local.get(QUEUE_KEY);
    return {
      timer: refreshedTimer,
      elapsedSeconds: elapsedSeconds(refreshedTimer),
      connected: Boolean(token),
      queued: queued.length,
    };
  }

  if (message.type === "connect")
    return { connected: true, ...(await connectKazi()) };

  if (message.type === "get-clients") return getClients();

  if (message.type === "disconnect") {
    await disconnectKazi();
    return { connected: false };
  }

  if (message.type === "start") {
    if (timer) return { error: "A timer is already active" };
    const next = {
      task: message.task,
      client: message.client || "",
      category: message.category,
      startedAt: Date.now(),
      elapsedMs: 0,
      running: true,
      source: "extension",
    };
    await chrome.storage.local.set({ [TIMER_KEY]: next });
    await saveSharedTimer(next);
    return { timer: next };
  }

  if (!timer) return { error: "No active timer" };

  if (message.type === "pause") {
    const next = {
      ...timer,
      elapsedMs: elapsedSeconds(timer) * 1000,
      running: false,
    };
    await chrome.storage.local.set({ [TIMER_KEY]: next });
    await saveSharedTimer(next);
    await transitionSharedTimer("pause", next);
    return { timer: next };
  }

  if (message.type === "resume") {
    const next = { ...timer, startedAt: Date.now(), running: true };
    await chrome.storage.local.set({ [TIMER_KEY]: next });
    await saveSharedTimer(next);
    await transitionSharedTimer("resume", next);
    return { timer: next };
  }

  if (message.type === "stop") {
    const entry = {
      id: crypto.randomUUID(),
      task: timer.task,
      client: timer.client,
      category: timer.category,
      seconds: elapsedSeconds(timer),
      stoppedAt: new Date().toISOString(),
    };
    const { [QUEUE_KEY]: queued = [] } =
      await chrome.storage.local.get(QUEUE_KEY);
    await chrome.storage.local.set({
      [TIMER_KEY]: null,
      [QUEUE_KEY]: [...queued, entry],
    });
    await clearSharedTimer();
    return { entry, ...(await syncQueue()) };
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
