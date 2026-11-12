const $ = (selector) => document.querySelector(selector);
const KAZI_URL = "https://kazi.growthpad.africa/pulse/checkins?tab=daily";
let activeTimer = null;
let connected = false;
let ticker = null;
let clients = [];
let selectedClient = "";
let activeClientIndex = -1;
let reconnectNeeded = false;
let gmailEnabled = false;

function clientInput() {
  return $("#client-search");
}
function clientOptions() {
  return $("#client-options");
}

function closeClientOptions() {
  clientOptions().hidden = true;
  clientInput().setAttribute("aria-expanded", "false");
  activeClientIndex = -1;
}

function openClientOptions() {
  clientOptions().hidden = false;
  clientInput().setAttribute("aria-expanded", "true");
  renderClientOptions();
}

function selectClient(name) {
  selectedClient = name;
  clientInput().value = name;
  $("#clear-client").hidden = !name;
  closeClientOptions();
}

function renderClientOptions() {
  const options = clientOptions();
  const term = clientInput().value.trim().toLowerCase();
  const matches = clients
    .filter((name) => name.toLowerCase().includes(term))
    .slice(0, 50);
  options.replaceChildren();
  if (!matches.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = clients.length
      ? "No matching saved client or project."
      : "No saved clients or projects yet.";
    options.append(empty);
    const manage = document.createElement("li");
    manage.className = "manage";
    manage.textContent = "Open Kazi to manage clients";
    manage.addEventListener("mousedown", (event) => {
      event.preventDefault();
      chrome.tabs.create({ url: KAZI_URL });
      closeClientOptions();
    });
    options.append(manage);
    return;
  }
  matches.forEach((name, index) => {
    const option = document.createElement("li");
    option.id = `client-option-${index}`;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(index === activeClientIndex));
    option.textContent = name;
    option.addEventListener("mousedown", (event) => {
      event.preventDefault();
      selectClient(name);
    });
    options.append(option);
  });
}

function format(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function currentSeconds() {
  if (!activeTimer) return 0;
  const runningMs =
    activeTimer.running && activeTimer.startedAt
      ? Date.now() - Date.parse(activeTimer.startedAt)
      : 0;
  return Math.floor((activeTimer.accumulatedMs + runningMs) / 1000);
}

function render() {
  const running = Boolean(activeTimer);
  $("#timer-panel").hidden = !running;
  $("#start-form").hidden = running;
  $("#status").textContent = activeTimer?.running
    ? "Timer running"
    : activeTimer
      ? "Timer paused"
      : "Ready to track";
  if (!activeTimer) return;
  $("#task-name").textContent = activeTimer.task;
  $("#task-meta").textContent = [activeTimer.client, activeTimer.category]
    .filter(Boolean)
    .join(" · ");
  $("#elapsed").textContent = format(currentSeconds());
  $("#pause").textContent = activeTimer.running ? "Pause" : "Resume";
  const needsConnection = activeTimer.source === "kazi" && !connected;
  $("#pause").disabled = needsConnection;
  $("#stop").disabled = needsConnection;
  $("#pause").title = needsConnection
    ? "Connect Kazi to control this timer here"
    : "";
  $("#stop").title = needsConnection
    ? "Connect Kazi to control this timer here"
    : "";
  $("#pause").hidden = false;
  $("#stop").hidden = false;
  $("#manage-kazi").hidden = true;
}

function send(type, values = {}) {
  return chrome.runtime.sendMessage({ type, ...values });
}

function formatMinutes(total) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours && minutes
    ? `${hours}h ${minutes}m`
    : hours
      ? `${hours}h`
      : `${minutes}m`;
}

// Today's logged tasks. Resume starts a new session for the task; stopping it
// adds the time to the same row. Delete removes the row from today's log.
async function renderToday() {
  const today = await send("list-today");
  const list = $("#today-list");
  const empty = $("#today-empty");
  list.replaceChildren();
  $("#today").hidden = !today.connected;
  if (today.reconnect) {
    connected = false;
    reconnectNeeded = true;
    $("#connect").textContent = "Reconnect Kazi";
    $("#notice").textContent = today.error;
    render();
    return;
  }
  if (!today.connected) return;
  if (today.error) {
    $("#notice").textContent = today.error;
  }
  empty.hidden = Boolean(today.entries?.length);
  for (const entry of today.entries || []) {
    const item = document.createElement("li");
    const meta = document.createElement("div");
    meta.className = "today-meta";
    const name = document.createElement("strong");
    name.textContent = entry.task;
    const details = document.createElement("span");
    details.textContent = [entry.client, formatMinutes(entry.minutes)]
      .filter(Boolean)
      .join(" · ");
    meta.append(name, details);
    const actions = document.createElement("div");
    actions.className = "today-actions";
    const resume = document.createElement("button");
    resume.type = "button";
    resume.className = "secondary";
    resume.textContent = "Resume";
    resume.disabled = Boolean(activeTimer) || !today.editable;
    resume.addEventListener("click", async () => {
      const result = await send("start", {
        task: entry.task,
        client: entry.client || "",
        category: entry.category,
        baseMinutes: entry.minutes,
      });
      if (result.error) {
        $("#notice").textContent = result.error;
        return;
      }
      await load();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "link";
    remove.textContent = "Delete";
    remove.disabled = !today.editable;
    remove.addEventListener("click", async () => {
      if (
        !confirm(
          `Delete "${entry.task}" (${formatMinutes(entry.minutes)}) from today's log?`,
        )
      )
        return;
      const result = await send("delete-entry", {
        date: today.date,
        index: entry.index,
        task: entry.task,
      });
      $("#notice").textContent = result.error || "Deleted from today's log.";
      await renderToday();
    });
    actions.append(resume, remove);
    item.append(meta, actions);
    list.append(item);
  }
}

async function load() {
  const state = await send("get-state");
  activeTimer = state.timer || null;
  connected = state.connected;
  reconnectNeeded = false;
  $("#queued").textContent = state.queued ? `${state.queued} queued` : "";
  $("#connect").textContent = state.connected ? "Disconnect" : "Connect Kazi";
  $("#notice").textContent = state.connected
    ? "Completed timers sync to your Kazi daily log. Your connection stays active for this browser session."
    : activeTimer?.source === "kazi"
      ? "This timer is running in Kazi. Connect Kazi to pause, resume, or stop it from your toolbar."
      : "Connect Kazi to sync completed entries. Until then, they stay only in this browser.";
  clients = [];
  if (state.connected) {
    const response = await send("get-clients");
    clients = response.clients || [];
  }
  renderClientOptions();
  render();
  clearInterval(ticker);
  ticker = setInterval(render, 1000);
  await renderToday();
}

$("#start-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = await send("start", {
    task: $("#task").value.trim(),
    client: selectedClient,
    category: $("#category").value,
  });
  if (result.error) {
    $("#notice").textContent = result.error;
    return;
  }
  activeTimer = result.timer;
  render();
});

$("#pause").addEventListener("click", async () => {
  const result = await send(activeTimer.running ? "pause" : "resume");
  if (result.error) {
    $("#notice").textContent = result.error;
    return;
  }
  activeTimer = result.timer;
  render();
});

$("#stop").addEventListener("click", async () => {
  const result = await send("stop");
  activeTimer = null;
  if (!result.entry) {
    $("#notice").textContent = result.error || "Could not stop this timer.";
  } else if (result.queued) {
    $("#notice").textContent =
      "Saved on this browser. It will sync to Kazi when it is reachable.";
  } else {
    $("#notice").textContent = "Stopped and saved to your Kazi daily log.";
  }
  await load();
});

function renderMiniSites(state) {
  const list = $("#mini-sites");
  list.replaceChildren();
  for (const origin of state.sites) {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = origin.replace(/^https?:\/\//, "");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "link";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => removeMiniSite(origin));
    item.append(label, remove);
    list.append(item);
  }
}

async function loadMiniTimer() {
  renderMiniSites(await send("mini-get-state"));
}

async function loadGmailTimer() {
  const state = await send("gmail-get-state");
  gmailEnabled = state.enabled === true;
  $("#gmail-toggle").textContent = gmailEnabled
    ? "Hide in Gmail"
    : "Show in Gmail";
}

async function removeMiniSite(origin) {
  await chrome.permissions.remove({ origins: [`${origin}/*`] }).catch(() => {});
  renderMiniSites(await send("mini-set-site", { origin, enabled: false }));
}

$("#mini-add").addEventListener("click", async () => {
  const button = $("#mini-add");
  button.disabled = true;
  button.textContent = "Checking site…";
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    let origin = null;
    try {
      origin = new URL(tab?.url || "").origin;
    } catch {
      origin = null;
    }
    if (!origin || !origin.startsWith("https://")) {
      $("#notice").textContent =
        "Open a secure (https) site, then choose Show on this site.";
      return;
    }
    // Requested straight from the click so Chrome can show its prompt.
    const granted = await chrome.permissions
      .request({ origins: [`${origin}/*`] })
      .catch(() => false);
    if (!granted) {
      $("#notice").textContent = `Access to ${origin} was not allowed.`;
      return;
    }
    // Choosing a site is itself the opt-in, so turn the feature on if needed.
    await send("mini-set-enabled", { enabled: true });
    renderMiniSites(await send("mini-set-site", { origin, enabled: true }));
    $("#notice").textContent =
      `Floating timer added for ${origin.replace(/^https:\/\//, "")}.`;
  } finally {
    button.disabled = false;
    button.textContent = "Enable timer on this site";
  }
});

$("#gmail-toggle").addEventListener("click", async () => {
  const button = $("#gmail-toggle");
  button.disabled = true;
  try {
    if (gmailEnabled) {
      await send("gmail-set-enabled", { enabled: false });
      $("#notice").textContent = "Gmail timer hidden.";
    } else {
      await send("gmail-set-enabled", { enabled: true });
      $("#notice").textContent =
        "Gmail timer shown. Open an email to start from its subject.";
    }
  } finally {
    button.disabled = false;
    await loadGmailTimer();
  }
});

$("#open-kazi").addEventListener("click", () =>
  chrome.tabs.create({ url: KAZI_URL }),
);
$("#manage-kazi").addEventListener("click", () =>
  chrome.tabs.create({ url: KAZI_URL }),
);
clientInput().addEventListener("focus", openClientOptions);
clientInput().addEventListener("input", () => {
  selectedClient = "";
  $("#clear-client").hidden = true;
  activeClientIndex = -1;
  openClientOptions();
});
clientInput().addEventListener("keydown", (event) => {
  const matches = clients
    .filter((name) =>
      name.toLowerCase().includes(clientInput().value.trim().toLowerCase()),
    )
    .slice(0, 50);
  if (event.key === "Escape") {
    closeClientOptions();
    return;
  }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    if (clientOptions().hidden) openClientOptions();
    if (matches.length) {
      activeClientIndex =
        event.key === "ArrowDown"
          ? (activeClientIndex + 1) % matches.length
          : (activeClientIndex - 1 + matches.length) % matches.length;
      clientInput().setAttribute(
        "aria-activedescendant",
        `client-option-${activeClientIndex}`,
      );
      renderClientOptions();
    }
  }
  if (
    event.key === "Enter" &&
    activeClientIndex >= 0 &&
    matches[activeClientIndex]
  ) {
    event.preventDefault();
    selectClient(matches[activeClientIndex]);
  }
});
clientInput().addEventListener("blur", () =>
  setTimeout(closeClientOptions, 120),
);
$("#clear-client").addEventListener("click", () => {
  selectClient("");
  clientInput().focus();
  openClientOptions();
});
$("#connect").addEventListener("click", async () => {
  $("#connect").disabled = true;
  try {
    const action = reconnectNeeded
      ? "connect"
      : (await send("get-state")).connected
        ? "disconnect"
        : "connect";
    const state = await send(action);
    $("#notice").textContent = state.connected
      ? `Kazi connected${state.synced ? `. Synced ${state.synced} queued task${state.synced === 1 ? "" : "s"}.` : "."}`
      : "Kazi disconnected. Timer entries remain on this browser until you reconnect.";
    await load();
  } catch (error) {
    $("#notice").textContent = error.message || "Could not connect Kazi.";
  } finally {
    $("#connect").disabled = false;
  }
});
load();
loadMiniTimer();
loadGmailTimer();
