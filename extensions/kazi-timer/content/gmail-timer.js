// Gmail message helper. It is available by default and can be hidden from the
// Kazi Timer popup. The subject is read only at the point a staff member
// chooses Start timer; email bodies, recipients, attachments and mailbox
// history are never read or stored.
(() => {
  if (window.__kaziGmailTimer) return;
  window.__kaziGmailTimer = true;

  const buttonId = "kazi-gmail-start-timer";
  let mountQueued = false;
  let activeTimer = null;
  let gmailEnabled = false;

  function isVisible(element) {
    const rect = element?.getBoundingClientRect();
    return Boolean(rect?.width && rect.height);
  }

  // Gmail's desktop subject has remained an h2.hP, but the alternatives keep
  // this narrowly scoped to the open-message title if the class changes.
  function subjectElement() {
    return [
      ...document.querySelectorAll(
        'h2.hP, h2[data-thread-perm-id], [role="main"] h2',
      ),
    ].find((element) => isVisible(element));
  }

  function subject() {
    return (
      subjectElement()
        ?.textContent?.replace(/\s+/g, " ")
        .trim()
        .slice(0, 200) || ""
    );
  }

  function sameTask(a, b) {
    return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
  }

  function render(button) {
    if (!button) return;
    const title = subject();
    if (activeTimer && sameTask(activeTimer.task, title)) {
      button.disabled = true;
      button.textContent = activeTimer.running
        ? "Timer running"
        : "Timer paused";
      button.setAttribute(
        "aria-label",
        `${button.textContent} for this email subject`,
      );
      return;
    }
    if (activeTimer) {
      button.disabled = true;
      button.textContent = "Timer on another task";
      button.setAttribute("aria-label", "A Kazi timer is already running");
      return;
    }
    button.disabled = !title;
    button.textContent = "Start Kazi timer";
    button.setAttribute(
      "aria-label",
      "Start Kazi timer using this email subject",
    );
  }

  function mount() {
    if (!gmailEnabled) return;
    const heading = subjectElement();
    if (!heading) return;
    const existing = document.getElementById(buttonId);
    if (existing) {
      render(existing);
      return;
    }
    const button = document.createElement("button");
    button.id = buttonId;
    button.type = "button";
    button.style.cssText =
      "margin-left:12px;border:0;border-radius:8px;padding:7px 10px;background:#f05d23;color:#fff;font:600 12px system-ui;cursor:pointer;vertical-align:middle;white-space:nowrap;";
    button.addEventListener("click", async () => {
      const task = subject();
      if (!task) {
        window.alert(
          "Open an email with a subject before starting the Kazi timer.",
        );
        return;
      }
      button.disabled = true;
      button.textContent = "Starting…";
      const result = await chrome.runtime.sendMessage({
        type: "start",
        task,
        category: "Other",
        sourceUrl: window.location.href,
      });
      if (result?.error) {
        window.alert(result.error);
      } else {
        activeTimer = result.timer;
      }
      render(button);
    });
    heading.insertAdjacentElement("afterend", button);
    render(button);
  }

  function queueMount() {
    if (mountQueued) return;
    mountQueued = true;
    requestAnimationFrame(() => {
      mountQueued = false;
      mount();
    });
  }

  chrome.storage.local
    .get(["timer", "gmailTimerEnabled"])
    .then(({ timer, gmailTimerEnabled: enabled }) => {
      activeTimer = timer || null;
      gmailEnabled = enabled !== false;
      if (gmailEnabled) queueMount();
    })
    .catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if ("gmailTimerEnabled" in changes) {
      gmailEnabled = changes.gmailTimerEnabled.newValue !== false;
      if (gmailEnabled) queueMount();
      else document.getElementById(buttonId)?.remove();
    }
    if ("timer" in changes) {
      activeTimer = changes.timer.newValue || null;
      render(document.getElementById(buttonId));
    }
  });

  new MutationObserver(queueMount).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  queueMount();
})();
