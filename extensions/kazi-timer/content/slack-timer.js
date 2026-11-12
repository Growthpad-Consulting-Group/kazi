// Slack channel helper. It reads only the current visible channel or direct
// message label after the staff member clicks Start Kazi timer. Slack message
// content, threads, people, files and workspace history are never read.
(() => {
  if (window.__kaziSlackTimer) return;
  window.__kaziSlackTimer = true;

  const buttonId = "kazi-slack-start-timer";
  let queued = false;
  let activeTimer = null;

  function isVisible(element) {
    const rect = element?.getBoundingClientRect();
    return Boolean(rect?.width && rect.height);
  }

  function contextElement() {
    return [
      ...document.querySelectorAll(
        '[data-qa="channel_name"], [data-qa="channel_header_name"], [data-qa="dm_header_name"]',
      ),
    ].find((element) => isVisible(element));
  }

  function taskTitle() {
    const label = contextElement()
      ?.textContent?.replace(/\s+/g, " ")
      .trim()
      .slice(0, 180);
    return label ? `Slack: ${label}` : "";
  }

  function sameTask(a, b) {
    return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
  }

  function render(button) {
    if (!button) return;
    const task = taskTitle();
    if (activeTimer && sameTask(activeTimer.task, task)) {
      button.disabled = true;
      button.textContent = activeTimer.running
        ? "Timer running"
        : "Timer paused";
      return;
    }
    if (activeTimer) {
      button.disabled = true;
      button.textContent = "Timer on another task";
      return;
    }
    button.disabled = !task;
    button.textContent = "Start Kazi timer";
  }

  function mount() {
    const heading = contextElement();
    if (!heading) return;
    const existing = document.getElementById(buttonId);
    if (existing) {
      render(existing);
      return;
    }
    const button = document.createElement("button");
    button.id = buttonId;
    button.type = "button";
    button.setAttribute(
      "aria-label",
      "Start Kazi timer for this Slack conversation",
    );
    button.style.cssText =
      "margin-left:10px;border:0;border-radius:8px;padding:6px 9px;background:#f05d23;color:#fff;font:600 12px system-ui;cursor:pointer;vertical-align:middle;white-space:nowrap;";
    button.addEventListener("click", async () => {
      const task = taskTitle();
      if (!task) return;
      button.disabled = true;
      button.textContent = "Starting…";
      const result = await chrome.runtime.sendMessage({
        type: "start",
        task,
        category: "Meetings",
        sourceUrl: window.location.href,
      });
      if (result?.error) window.alert(result.error);
      else activeTimer = result.timer;
      render(button);
    });
    heading.insertAdjacentElement("afterend", button);
    render(button);
  }

  function queueMount() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      mount();
    });
  }

  chrome.storage.local
    .get(["timer"])
    .then(({ timer }) => {
      activeTimer = timer || null;
      queueMount();
    })
    .catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !("timer" in changes)) return;
    activeTimer = changes.timer.newValue || null;
    render(document.getElementById(buttonId));
  });
  new MutationObserver(queueMount).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  queueMount();
})();
