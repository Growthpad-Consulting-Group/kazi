// Runs only on Kazi. It reads the active timer already stored by Kazi and
// forwards the minimum state needed for the toolbar badge and popup. It never
// reads page content, form fields or browsing data.
const KAZI_TIMER_KEY = "kazi:daily-log:active-timer";
const KAZI_TIMER_EVENT = "kazi:daily-log:timer-change";

function readKaziTimer() {
  try {
    const timer = JSON.parse(
      window.localStorage.getItem(KAZI_TIMER_KEY) || "null",
    );
    if (!timer?.startedAt || !timer?.row?.task) return null;
    return {
      task: String(timer.row.task),
      client: typeof timer.row.client === "string" ? timer.row.client : "",
      category:
        typeof timer.row.category === "string"
          ? timer.row.category
          : "Projects",
      startedAt: timer.startedAt,
      elapsedMs: (timer.accumulatedSeconds || 0) * 1000,
      running: true,
      source: "kazi",
    };
  } catch {
    return null;
  }
}

function syncKaziTimer() {
  chrome.runtime
    .sendMessage({ type: "kazi-page-timer", timer: readKaziTimer() })
    .catch(() => {});
}

syncKaziTimer();
window.addEventListener(KAZI_TIMER_EVENT, syncKaziTimer);
window.addEventListener("storage", (event) => {
  if (event.key === KAZI_TIMER_KEY) syncKaziTimer();
});
