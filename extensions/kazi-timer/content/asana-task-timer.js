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
  const pauseButtonId = "kazi-asana-pause-timer";
  const stopButtonId = "kazi-asana-stop-timer";
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
  let timerSources = {};
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

  // The control group describes the timer only when it belongs to the task on
  // screen. A timer for another task is shown as busy, not as running here.
  function sameTask(a, b) {
    return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
  }

  function setControlsVisible(visible) {
    const pause = document.getElementById(pauseButtonId);
    const stop = document.getElementById(stopButtonId);
    if (pause) pause.hidden = !visible;
    if (stop) stop.hidden = !visible;
  }

  function renderButton(button) {
    if (!button) return;
    const pause = document.getElementById(pauseButtonId);
    if (activeTimer) {
      const onThisTask = sameTask(activeTimer.task, taskTitle(taskPane()));
      if (onThisTask) {
        button.disabled = true;
        button.textContent = formatClock(elapsedMs(activeTimer));
        button.setAttribute(
          "aria-label",
          `${activeTimer.running ? "Timer running" : "Timer paused"}: ${button.textContent}`,
        );
        if (pause) {
          pause.disabled = false;
          pause.textContent = activeTimer.running ? "Pause" : "Resume";
          pause.setAttribute(
            "aria-label",
            activeTimer.running
              ? "Pause Kazi timer for this Asana task"
              : "Resume Kazi timer for this Asana task",
          );
        }
        setControlsVisible(true);
      } else if (timerSources[activeTimer.id]) {
        button.disabled = false;
        button.textContent = "Open running task";
        button.setAttribute(
          "aria-label",
          "Open the Asana task with the running Kazi timer",
        );
        setControlsVisible(false);
      } else {
        button.disabled = true;
        button.textContent = "Timer on another task";
        button.setAttribute(
          "aria-label",
          "A Kazi timer is running on another task",
        );
        setControlsVisible(false);
      }
      return;
    }
    button.disabled = false;
    button.textContent = "Start timer";
    button.setAttribute("aria-label", "Start Kazi timer for this Asana task");
    setControlsVisible(false);
  }

  function currentButton() {
    return document.getElementById(buttonId);
  }

  function createButton(pane) {
    const controls = document.createElement("span");
    controls.id = "kazi-asana-timer-controls";
    controls.style.cssText =
      "display:inline-flex;align-items:center;gap:6px;margin-left:8px;";
    const button = document.createElement("button");
    button.id = buttonId;
    button.type = "button";
    button.textContent = "Start timer";
    button.setAttribute("aria-label", "Start Kazi timer for this Asana task");
    button.style.cssText =
      "border:0;border-radius:8px;padding:6px 9px;background:#f05d23;color:#fff;font:600 12px system-ui;cursor:pointer;white-space:nowrap;";
    button.addEventListener("click", async () => {
      if (activeTimer && !sameTask(activeTimer.task, taskTitle(taskPane()))) {
        const url = timerSources[activeTimer.id];
        if (url) window.location.assign(url);
        return;
      }
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
        reuseExistingActivity: true,
        openPopup: true,
        sourceUrl: window.location.href,
      });
      if (result?.error) {
        renderButton(button);
        window.alert(result.error);
      } else {
        activeTimer = result.timer;
        renderButton(button);
      }
    });
    const pause = document.createElement("button");
    pause.id = pauseButtonId;
    pause.type = "button";
    pause.hidden = true;
    pause.style.cssText =
      "border:1px solid #d9dce2;border-radius:8px;padding:6px 9px;background:#fff;color:#374151;font:600 12px system-ui;cursor:pointer;white-space:nowrap;";
    pause.addEventListener("click", async () => {
      if (!activeTimer) return;
      pause.disabled = true;
      const result = await chrome.runtime.sendMessage({
        type: activeTimer.running ? "pause" : "resume",
      });
      pause.disabled = false;
      if (result?.error) {
        window.alert(result.error);
        return;
      }
      activeTimer = result.timer;
      renderButton(button);
    });
    const stop = document.createElement("button");
    stop.id = stopButtonId;
    stop.type = "button";
    stop.hidden = true;
    stop.textContent = "Stop";
    stop.setAttribute("aria-label", "Stop Kazi timer for this Asana task");
    stop.style.cssText =
      "border:1px solid #fecaca;border-radius:8px;padding:6px 9px;background:#fff1f2;color:#be123c;font:600 12px system-ui;cursor:pointer;white-space:nowrap;";
    stop.addEventListener("click", async () => {
      if (!activeTimer) return;
      stop.disabled = true;
      const result = await chrome.runtime.sendMessage({ type: "stop" });
      stop.disabled = false;
      if (result?.error) {
        window.alert(result.error);
        return;
      }
      activeTimer = null;
      renderButton(button);
    });
    controls.append(button, pause, stop);
    return controls;
  }

  function mount() {
    const pane = taskPane();
    const toolbar = taskToolbar(pane);
    const complete = completionButton(toolbar);
    if (!pane || !toolbar || !complete || !taskTitle(pane)) return;

    const existing = currentButton();
    if (existing) {
      if (existing.parentElement?.parentElement === complete.parentElement) {
        renderButton(existing);
        return;
      }
      existing.parentElement?.remove();
    }
    const controls = createButton(pane);
    complete.insertAdjacentElement("afterend", controls);
    renderButton(controls.querySelector(`#${buttonId}`));
  }

  // Refresh the elapsed time once a second while a timer is running.
  setInterval(() => {
    if (activeTimer?.running) renderButton(currentButton());
  }, 1000);

  chrome.storage.local
    .get(["timer", "timerSources"])
    .then(({ timer, timerSources: sources }) => {
      activeTimer = timer || null;
      timerSources = sources || {};
      renderButton(currentButton());
    })
    .catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if ("timerSources" in changes)
      timerSources = changes.timerSources.newValue || {};
    if ("timer" in changes) activeTimer = changes.timer.newValue || null;
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
