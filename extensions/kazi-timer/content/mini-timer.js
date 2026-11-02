// Floating timer overlay. Injected only into sites the staff member chose, and
// only while the opt-in is on. It reads the Kazi Timer state from extension
// storage and sends pause, resume, stop or start requests to the background
// worker. It reads the page title only when the staff member clicks "Start from
// this page", and never reads page content, forms or credentials.
(() => {
  if (window.__kaziMiniTimer) return;
  window.__kaziMiniTimer = true;

  const TIMER_KEY = "timer";
  const SITES_KEY = "miniTimerSites";
  const ENABLED_KEY = "miniTimerEnabled";
  const KAZI_URL = "https://kazi.growthpad.africa/pulse/checkins?tab=daily";

  const host = document.createElement("div");
  host.id = "kazi-mini-timer";
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      .card {
        position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
        min-width: 220px; max-width: 320px; padding: 10px 12px;
        border-radius: 14px; background: #ffffff; color: #18181b;
        border: 1px solid #e4e4e7; box-shadow: 0 8px 24px rgb(0 0 0 / 0.14);
        font: 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      .running { display: flex; align-items: center; gap: 10px; }
      .idle { display: flex; flex-direction: column; gap: 8px; }
      [hidden] { display: none !important; }
      .meta { min-width: 0; flex: 1; }
      .task { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .elapsed { font-variant-numeric: tabular-nums; color: #71717a; }
      .row { display: flex; gap: 8px; }
      input {
        flex: 1; min-width: 0; font: inherit; padding: 6px 8px; border-radius: 8px;
        border: 1px solid #e4e4e7; background: #ffffff; color: #18181b;
      }
      button, a {
        font: inherit; border: 0; border-radius: 8px; padding: 6px 8px;
        cursor: pointer; background: #f1f1f3; color: #18181b; text-decoration: none;
      }
      button.primary { background: #f05d23; color: #ffffff; }
      button.stop { background: #fee2e2; color: #b91c1c; }
      a.open { color: #d94f1c; }
      .hint { color: #71717a; font-size: 12px; }
      @media (prefers-color-scheme: dark) {
        .card { background: #131417; color: #f4f4f5; border-color: #26282c; }
        .elapsed, .hint { color: #8b8d93; }
        input { background: #1a1c1f; color: #f4f4f5; border-color: #26282c; }
        button, a { background: #1a1c1f; color: #f4f4f5; }
        button.primary { background: #f05d23; color: #ffffff; }
        button.stop { background: #3f1d1d; color: #fca5a5; }
        a.open { color: #f05d23; }
      }
    </style>
    <div class="card" role="status" aria-live="off">
      <div class="running" hidden>
        <div class="meta">
          <div class="task"></div>
          <div class="elapsed"></div>
        </div>
        <button type="button" data-action="toggle"></button>
        <button type="button" class="stop" data-action="stop">Stop</button>
        <a class="open" href="#" target="_blank" rel="noopener">Kazi</a>
      </div>
      <form class="idle" hidden>
        <div class="row">
          <input name="task" maxlength="200" required aria-label="Task name"
            placeholder="What are you working on?" />
          <button type="submit" class="primary">Start</button>
        </div>
        <button type="button" data-action="prefill">Start from this page</button>
        <span class="hint">Fills in the page title. Edit it before you start.</span>
      </form>
    </div>`;

  root.querySelector("a.open").href = KAZI_URL;
  const runningPanel = root.querySelector(".running");
  const idlePanel = root.querySelector(".idle");
  const taskInput = root.querySelector('input[name="task"]');
  const taskLabel = root.querySelector(".task");
  const elapsedLabel = root.querySelector(".elapsed");
  const toggle = root.querySelector('[data-action="toggle"]');

  function format(milliseconds) {
    const total = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const pad = (value) => String(value).padStart(2, "0");
    return hours
      ? `${hours}:${pad(minutes)}:${pad(seconds)}`
      : `${minutes}:${pad(seconds)}`;
  }

  function elapsedMs(timer, now = Date.now()) {
    const runningMs =
      timer.running && timer.startedAt ? now - Date.parse(timer.startedAt) : 0;
    return timer.accumulatedMs + runningMs;
  }

  // Drops a trailing app name such as " - Asana" when there is one.
  function taskFromTitle(title) {
    const cleaned = String(title || "")
      .replace(/\s+/g, " ")
      .trim();
    const parts = cleaned.split(/\s[-–|·]\s/);
    const task =
      parts.length > 1 && parts[parts.length - 1].length <= 30
        ? parts.slice(0, -1).join(" - ")
        : cleaned;
    return task.slice(0, 200);
  }

  // Shown only when the opt-in is on and this site is chosen. A running timer
  // shows its controls; otherwise the card offers to start one.
  let editing = false;
  async function render() {
    const data = await chrome.storage.local.get([
      TIMER_KEY,
      SITES_KEY,
      ENABLED_KEY,
    ]);
    const timer = data[TIMER_KEY];
    const enabledHere =
      data[ENABLED_KEY] === true &&
      (data[SITES_KEY] || []).includes(location.origin);
    if (!enabledHere) {
      host.remove();
      return;
    }
    if (!host.isConnected) document.documentElement.append(host);

    if (timer) {
      runningPanel.hidden = false;
      idlePanel.hidden = true;
      taskLabel.textContent = timer.task;
      elapsedLabel.textContent = format(elapsedMs(timer));
      toggle.textContent = timer.running ? "Pause" : "Resume";
      toggle.dataset.running = String(timer.running);
      return;
    }
    runningPanel.hidden = true;
    idlePanel.hidden = false;
  }

  function send(message) {
    return chrome.runtime.sendMessage(message).catch(() => ({}));
  }

  root.addEventListener("click", (event) => {
    const action = event.target?.dataset?.action;
    if (action === "toggle")
      send({ type: toggle.dataset.running === "true" ? "pause" : "resume" });
    if (action === "stop") send({ type: "stop" });
    if (action === "prefill") {
      // The title is read only on this click, and the staff member can edit it.
      taskInput.value = taskFromTitle(document.title);
      editing = true;
      taskInput.focus();
    }
  });

  idlePanel.addEventListener("submit", async (event) => {
    event.preventDefault();
    const task = taskInput.value.trim();
    if (!task) return;
    const result = await send({ type: "start", task, category: "Projects" });
    if (result.error) {
      taskInput.setCustomValidity(result.error);
      taskInput.reportValidity();
      return;
    }
    taskInput.value = "";
    editing = false;
    render();
  });

  taskInput.addEventListener("input", () => {
    taskInput.setCustomValidity("");
    editing = true;
  });

  chrome.storage.onChanged.addListener(render);
  // Pause the 1-second refresh while the staff member is typing a task name.
  setInterval(() => {
    if (!editing) render();
  }, 1000);
  render();
})();
