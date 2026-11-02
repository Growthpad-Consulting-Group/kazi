// Floating timer overlay. Injected only into sites the staff member chose, and
// only while the opt-in is on. It reads the Kazi Timer state from extension
// storage and sends pause, resume, stop or open requests to the background
// worker. It never reads this page's content, forms, history or credentials.
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
        display: flex; align-items: center; gap: 10px;
        min-width: 220px; max-width: 320px; padding: 10px 12px;
        border-radius: 14px; background: #ffffff; color: #18181b;
        border: 1px solid #e4e4e7; box-shadow: 0 8px 24px rgb(0 0 0 / 0.14);
        font: 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      .meta { min-width: 0; flex: 1; }
      .task { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .elapsed { font-variant-numeric: tabular-nums; color: #71717a; }
      button, a {
        font: inherit; border: 0; border-radius: 8px; padding: 6px 8px;
        cursor: pointer; background: #f1f1f3; color: #18181b; text-decoration: none;
      }
      button.stop { background: #fee2e2; color: #b91c1c; }
      a.open { color: #d94f1c; }
      @media (prefers-color-scheme: dark) {
        .card { background: #131417; color: #f4f4f5; border-color: #26282c; }
        .elapsed { color: #8b8d93; }
        button, a { background: #1a1c1f; color: #f4f4f5; }
        button.stop { background: #3f1d1d; color: #fca5a5; }
        a.open { color: #f05d23; }
      }
    </style>
    <div class="card" role="status" aria-live="off">
      <div class="meta">
        <div class="task"></div>
        <div class="elapsed"></div>
      </div>
      <button type="button" data-action="toggle"></button>
      <button type="button" class="stop" data-action="stop">Stop</button>
      <a class="open" href="${KAZI_URL}" target="_blank" rel="noopener">Kazi</a>
    </div>`;

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

  // Shows only when the opt-in is on, this site is chosen, and a timer exists.
  async function render() {
    const data = await chrome.storage.local.get([
      TIMER_KEY,
      SITES_KEY,
      ENABLED_KEY,
    ]);
    const timer = data[TIMER_KEY];
    const visible =
      data[ENABLED_KEY] === true &&
      (data[SITES_KEY] || []).includes(location.origin) &&
      Boolean(timer);
    if (!visible) {
      host.remove();
      return;
    }
    if (!host.isConnected) document.documentElement.append(host);
    taskLabel.textContent = timer.task;
    elapsedLabel.textContent = format(elapsedMs(timer));
    toggle.textContent = timer.running ? "Pause" : "Resume";
    toggle.dataset.running = String(timer.running);
  }

  function send(type) {
    chrome.runtime.sendMessage({ type }).catch(() => {});
  }

  root.addEventListener("click", (event) => {
    const action = event.target?.dataset?.action;
    if (action === "toggle")
      send(toggle.dataset.running === "true" ? "pause" : "resume");
    if (action === "stop") send("stop");
  });

  chrome.storage.onChanged.addListener(render);
  setInterval(render, 1000);
  render();
})();
