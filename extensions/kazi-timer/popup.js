const $ = (selector) => document.querySelector(selector);
const KAZI_URL = "https://kazi.growthpad.africa/pulse/checkins?tab=daily";
let activeTimer = null;
let ticker = null;

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
  return Math.floor((activeTimer.elapsedMs + (activeTimer.running ? Date.now() - activeTimer.startedAt : 0)) / 1000);
}

function render() {
  const running = Boolean(activeTimer);
  $("#timer-panel").hidden = !running;
  $("#start-form").hidden = running;
  $("#status").textContent = activeTimer?.running ? "Timer running" : activeTimer ? "Timer paused" : "Ready to track";
  if (!activeTimer) return;
  $("#task-name").textContent = activeTimer.task;
  $("#task-meta").textContent = [activeTimer.client, activeTimer.category].filter(Boolean).join(" · ");
  $("#elapsed").textContent = format(currentSeconds());
  $("#pause").textContent = activeTimer.running ? "Pause" : "Resume";
}

function send(type, values = {}) {
  return chrome.runtime.sendMessage({ type, ...values });
}

async function load() {
  const state = await send("get-state");
  activeTimer = state.timer || null;
  $("#queued").textContent = state.queued ? `${state.queued} queued` : "";
  $("#connect").textContent = state.connected ? "Disconnect" : "Connect Kazi";
  $("#notice").textContent = state.connected
    ? "Stopped tasks sync to your Kazi daily log. Your connection expires when you close the browser."
    : "Connect Kazi to sync completed entries. Until then, they stay only in this browser.";
  render();
  clearInterval(ticker);
  ticker = setInterval(render, 1000);
}

$("#start-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = await send("start", { task: $("#task").value.trim(), client: $("#client").value.trim(), category: $("#category").value });
  activeTimer = result.timer;
  render();
});

$("#pause").addEventListener("click", async () => {
  const result = await send(activeTimer.running ? "pause" : "resume");
  activeTimer = result.timer;
  render();
});

$("#stop").addEventListener("click", async () => {
  const result = await send("stop");
  activeTimer = null;
  $("#notice").textContent = result.entry ? "Saved to this browser's queue. Connect Kazi to sync it." : "Could not stop this timer.";
  await load();
});

$("#open-kazi").addEventListener("click", () => chrome.tabs.create({ url: KAZI_URL }));
$("#connect").addEventListener("click", async () => {
  $("#connect").disabled = true;
  try {
    const state = await send((await send("get-state")).connected ? "disconnect" : "connect");
    $("#notice").textContent = state.connected ? `Kazi connected${state.synced ? `. Synced ${state.synced} queued task${state.synced === 1 ? "" : "s"}.` : "."}` : "Kazi disconnected. Timer entries remain on this browser until you reconnect.";
    await load();
  } catch (error) {
    $("#notice").textContent = error.message || "Could not connect Kazi.";
  } finally {
    $("#connect").disabled = false;
  }
});
load();
