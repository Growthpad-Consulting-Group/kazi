// Opt-in Asana task helper. It only reads the title in the task pane the
// staff member has open. Descriptions, comments, attachments, credentials and
// other page data are never read.
//
// Asana is a single-page application, so it replaces the task pane without a
// document navigation. Keep this adapter scoped to that pane and re-mount when
// the pane changes rather than selecting headings or buttons across the page.
(() => {
  if (window.__kaziAsanaTaskTimer) return;
  window.__kaziAsanaTaskTimer = true;

  const buttonId = "kazi-asana-start-timer";
  let mountQueued = false;

  function isVisible(element) {
    const rect = element?.getBoundingClientRect();
    return Boolean(rect?.width && rect.height);
  }

  function taskPane() {
    const title = document.querySelector(
      [
        ".TaskPane-titleRow textarea",
        '.TaskPaneBody-main [role="heading"] textarea',
        '.TaskPaneBody-main [aria-label="Task Name"]',
        '.TaskPaneBody-main [data-testid="task-name"]',
        '[aria-label="Task Name"]',
        '[data-testid="task-name"]',
      ].join(","),
    );
    return title?.closest(".TaskPaneBody-main, .TaskPane") || null;
  }

  function taskTitle(pane) {
    const field = pane?.querySelector(
      [
        '[role="heading"] textarea',
        ".TaskPane-titleRow textarea",
        '[aria-label="Task Name"]',
        '[data-testid="task-name"]',
        '[data-testid*="task-title"]',
      ].join(","),
    );
    if (!field || !isVisible(field)) return "";
    const value =
      "value" in field && typeof field.value === "string"
        ? field.value
        : field.textContent;
    return value?.replace(/\s+/g, " ").trim().slice(0, 200) || "";
  }

  // Clockify's maintained Asana adapter uses this task-pane toolbar contract.
  // Keep the title field and completion action in the same pane so a board card
  // or Asana's left navigation can never receive the Kazi control.
  function taskToolbar(pane) {
    const root = pane?.closest(".TaskPane") || pane;
    const toolbar = root?.querySelector(".TaskPaneToolbarAnimation-row");
    return toolbar && isVisible(toolbar) ? toolbar : null;
  }

  function completionButton(toolbar) {
    // Asana renders its toolbar actions as div[role="button"], not <button>.
    return [
      ...(toolbar?.querySelectorAll('button, [role="button"]') || []),
    ].find(
      (button) =>
        isVisible(button) && button.textContent?.trim() === "Mark complete",
    );
  }

  // The Kazi timer lives in extension storage, so the button reflects it while
  // the page stays open. Stopping in the popup or on another tab resets it here.
  let activeTimer = null;
  function formatClock(milliseconds) {
    const total = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = String(total % 60).padStart(2, "0");
    return hours
      ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
      : `${minutes}:${seconds}`;
  }

  function elapsedMs(timer) {
    const runningMs =
      timer.running && timer.startedAt
        ? Date.now() - Date.parse(timer.startedAt)
        : 0;
    return timer.accumulatedMs + runningMs;
  }

  // The button describes the timer only when it belongs to the task on screen.
  // A timer for another task is shown as busy, not as running here.
  function sameTask(a, b) {
    return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
  }

  function renderButton(button) {
    if (!button) return;
    if (activeTimer) {
      const onThisTask = sameTask(activeTimer.task, taskTitle(taskPane()));
      if (onThisTask) {
        button.disabled = true;
        const state = activeTimer.running ? "Timer running" : "Timer paused";
        button.textContent = `${state} · ${formatClock(elapsedMs(activeTimer))}`;
      } else {
        button.disabled = true;
        button.textContent = "Timer on another task";
      }
      return;
    }
    button.disabled = false;
    button.textContent = "Start timer";
  }

  function currentButton() {
    return document.getElementById(buttonId);
  }

  function createButton(pane) {
    const button = document.createElement("button");
    button.id = buttonId;
    button.type = "button";
    button.textContent = "Start timer";
    button.setAttribute("aria-label", "Start Kazi timer for this Asana task");
    button.style.cssText =
      "margin-left:8px;border:0;border-radius:8px;padding:6px 9px;background:#f05d23;color:#fff;font:600 12px system-ui;cursor:pointer;white-space:nowrap;";
    button.addEventListener("click", async () => {
      const title = taskTitle(pane);
      if (!title) {
        window.alert(
          "Open a task with a title before starting the Kazi timer.",
        );
        return;
      }
      button.disabled = true;
      button.textContent = "Starting…";
      const result = await chrome.runtime.sendMessage({
        type: "start",
        task: title,
        category: "Projects",
      });
      if (result?.error) {
        renderButton(button);
        window.alert(result.error);
      } else {
        activeTimer = result.timer;
        renderButton(button);
      }
    });
    return button;
  }

  function mount() {
    const pane = taskPane();
    const toolbar = taskToolbar(pane);
    const complete = completionButton(toolbar);
    if (!pane || !toolbar || !complete || !taskTitle(pane)) return;

    const existing = currentButton();
    if (existing) {
      if (existing.parentElement === complete.parentElement) {
        renderButton(existing);
        return;
      }
      existing.remove();
    }
    const button = createButton(pane);
    complete.insertAdjacentElement("afterend", button);
    renderButton(button);
  }

  // Refresh the elapsed time once a second while a timer is running.
  setInterval(() => {
    if (activeTimer?.running) renderButton(currentButton());
  }, 1000);

  chrome.storage.local
    .get("timer")
    .then(({ timer }) => {
      activeTimer = timer || null;
      renderButton(currentButton());
    })
    .catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !("timer" in changes)) return;
    activeTimer = changes.timer.newValue || null;
    renderButton(currentButton());
  });

  function queueMount() {
    if (mountQueued) return;
    mountQueued = true;
    requestAnimationFrame(() => {
      mountQueued = false;
      mount();
    });
  }

  new MutationObserver(queueMount).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  queueMount();
})();
