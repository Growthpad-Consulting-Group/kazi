const $ = (selector) => document.querySelector(selector);
const send = (type, values = {}) =>
  chrome.runtime.sendMessage({ type, ...values });

function showNotice(message) {
  const notice = $("#mini-notice");
  notice.textContent = message;
  notice.hidden = !message;
}

function renderSites(state) {
  const list = $("#mini-sites");
  list.replaceChildren();
  for (const origin of state.sites || []) {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = origin.replace(/^https?:\/\//, "");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "link";
    remove.textContent = "Remove";
    remove.addEventListener("click", async () => {
      await chrome.permissions
        .remove({ origins: [`${origin}/*`] })
        .catch(() => {});
      renderSites(await send("mini-set-site", { origin, enabled: false }));
    });
    item.append(label, remove);
    list.append(item);
  }
}

async function load() {
  const [gmail, mini, settings] = await Promise.all([
    send("gmail-get-state"),
    send("mini-get-state"),
    chrome.storage.local.get("openPopupOnStart"),
  ]);
  $("#gmail-enabled").checked = gmail.enabled === true;
  $("#open-on-start").checked = settings.openPopupOnStart !== false;
  renderSites(mini);
}

$("#open-on-start").addEventListener("change", async (event) => {
  await chrome.storage.local.set({
    openPopupOnStart: event.currentTarget.checked,
  });
});

$("#gmail-enabled").addEventListener("change", async (event) => {
  await send("gmail-set-enabled", { enabled: event.currentTarget.checked });
});

$("#mini-add").addEventListener("click", async () => {
  const button = $("#mini-add");
  button.disabled = true;
  button.textContent = "Checking site…";
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    let origin = null;
    try {
      origin = new URL(tab?.url || "").origin;
    } catch {
      origin = null;
    }
    if (!origin || !origin.startsWith("https://")) {
      showNotice("Open a secure (https) site, then choose Add current site.");
      return;
    }
    const granted = await chrome.permissions
      .request({ origins: [`${origin}/*`] })
      .catch(() => false);
    if (!granted) {
      showNotice(`Access to ${origin} was not allowed.`);
      return;
    }
    await send("mini-set-enabled", { enabled: true });
    renderSites(await send("mini-set-site", { origin, enabled: true }));
    showNotice(
      `Floating timer added for ${origin.replace(/^https:\/\//, "")}.`,
    );
  } finally {
    button.disabled = false;
    button.textContent = "Add current site";
  }
});

load();
