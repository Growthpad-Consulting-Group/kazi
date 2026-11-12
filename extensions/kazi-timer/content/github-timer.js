// GitHub issue and pull-request helper. It reads only the visible title after
// the staff member clicks Start Kazi timer; discussions, descriptions, code,
// reviews, files and account data are never read or stored.
(() => {
  if (window.__kaziGitHubTimer) return;
  window.__kaziGitHubTimer = true;

  const buttonId = "kazi-github-start-timer";
  let queued = false;
  let activeTimer = null;

  function isVisible(element) {
    const rect = element?.getBoundingClientRect();
    return Boolean(rect?.width && rect.height);
  }

  function titleElement() {
    return [
      ...document.querySelectorAll(
        '[data-testid="issue-title"], h1.gh-header-title, .js-issue-title',
      ),
    ].find((element) => isVisible(element));
  }

  function title() {
    return (
      titleElement()?.textContent?.replace(/\s+/g, " ").trim().slice(0, 200) ||
      ""
    );
  }

  function sameTask(a, b) {
    return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
  }

  function render(button) {
    if (!button) return;
    const task = title();
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
    const heading = titleElement();
    if (!heading) return;
    const existing = document.getElementById(buttonId);
    if (existing) {
      render(existing);
      return;
    }
    const button = document.createElement("button");
    button.id = buttonId;
    button.type = "button";
    button.setAttribute("aria-label", "Start Kazi timer for this GitHub item");
    button.style.cssText =
      "margin-left:12px;border:0;border-radius:8px;padding:7px 10px;background:#f05d23;color:#fff;font:600 12px system-ui;cursor:pointer;vertical-align:middle;white-space:nowrap;";
    button.addEventListener("click", async () => {
      const task = title();
      if (!task) return;
      button.disabled = true;
      button.textContent = "Starting…";
      const result = await chrome.runtime.sendMessage({
        type: "start",
        task,
        category: "Projects",
        reuseExistingActivity: true,
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
