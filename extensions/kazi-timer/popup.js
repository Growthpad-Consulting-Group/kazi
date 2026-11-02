const $ = (selector) => document.querySelector(selector);
const KAZI_URL = "https://kazi.growthpad.africa/pulse/checkins?tab=daily";
let activeTimer = null;
let connected = false;
let ticker = null;
let clients = [];
let selectedClient = "";
let activeClientIndex = -1;

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

async function load() {
  const state = await send("get-state");
  activeTimer = state.timer || null;
  connected = state.connected;
  $("#queued").textContent = state.queued ? `${state.queued} queued` : "";
  $("#connect").textContent = state.connected ? "Disconnect" : "Connect Kazi";
  $("#notice").textContent = state.connected
    ? "Stopped tasks sync to your Kazi daily log. Your connection expires when you close the browser."
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
    const state = await send(
      (await send("get-state")).connected ? "disconnect" : "connect",
    );
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
