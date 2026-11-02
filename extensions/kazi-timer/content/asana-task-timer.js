// Opt-in Asana task helper. It reads only the currently visible task title
// after a staff member clicks the Kazi button; it never reads descriptions,
// comments, attachments, credentials, or background page data.
(() => {
  if (window.__kaziAsanaTaskTimer) return;
  window.__kaziAsanaTaskTimer = true;

  const buttonId = "kazi-asana-start-timer";
  const selectors = [
    '[data-testid="task-name"]',
    '[data-testid*="task-name"]',
    '[data-testid*="task-title"]',
    '[aria-label="Task Name"]',
    '[aria-label="Task name"]',
    'textarea[aria-label*="Task"]',
    '[contenteditable="true"][aria-label*="Task"]',
  ];

  function taskHeading() {
    return selectors
      .flatMap((selector) => [...document.querySelectorAll(selector)])
      .filter((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.left > window.innerWidth * 0.45 &&
          Boolean(
            candidate.textContent?.trim() ||
            ("value" in candidate && candidate.value?.trim()),
          )
        );
      })[0];
  }

  function taskTitle() {
    const element = taskHeading();
    const value =
      element && "value" in element && typeof element.value === "string"
        ? element.value
        : element?.textContent;
    return value?.replace(/\s+/g, " ").trim().slice(0, 200) || "";
  }

  function mount() {
    const target = taskHeading();
    if (!target?.parentElement) return;
    const existing = document.getElementById(buttonId);
    if (existing) {
      if (existing.parentElement !== target.parentElement) existing.remove();
      else return;
    }

    const button = document.createElement("button");
    button.id = buttonId;
    button.type = "button";
    button.textContent = "Start timer";
    button.style.cssText =
      "margin-left:8px;border:0;border-radius:8px;padding:6px 9px;background:#f05d23;color:#fff;font:600 12px system-ui;cursor:pointer;";
    button.addEventListener("click", async () => {
      const title = taskTitle();
      if (!title) return;
      button.disabled = true;
      button.textContent = "Starting…";
      const result = await chrome.runtime.sendMessage({
        type: "start",
        task: title,
        category: "Projects",
      });
      if (result?.error) {
        button.disabled = false;
        button.textContent = "Start timer";
        window.alert(result.error);
      } else button.textContent = "Timer running";
    });
    target.parentElement.append(button);
  }

  new MutationObserver(mount).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  mount();
})();
