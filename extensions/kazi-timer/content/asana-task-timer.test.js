// @vitest-environment jsdom
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// DOM-resilience tests for the Asana helper. The fixtures follow the markup
// Asana renders for the task pane; the helper must mount and read the title
// from more than one shape of it, and must do nothing when the layout is not
// recognised.

const SCRIPT = resolve(
  process.cwd(),
  "extensions/kazi-timer/content/asana-task-timer.js",
);
const BUTTON_ID = "kazi-asana-start-timer";

let storage;
let sendMessage;

function installChromeStub() {
  storage = { timer: null };
  sendMessage = vi.fn(async () => ({
    timer: {
      id: "t1",
      task: "Develop browser extension",
      running: true,
      accumulatedMs: 0,
      startedAt: new Date().toISOString(),
    },
  }));
  globalThis.chrome = {
    runtime: { sendMessage },
    storage: {
      local: {
        get: vi.fn(async (keys) => {
          const names = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(names.map((key) => [key, storage[key]]));
        }),
      },
      onChanged: { addListener: vi.fn() },
    },
  };
}

function visibleLayout() {
  // jsdom does no layout. The helper only needs a non-zero box for visibility.
  Element.prototype.getBoundingClientRect = () => ({
    width: 120,
    height: 24,
    top: 0,
    left: 0,
    right: 120,
    bottom: 24,
  });
}

async function loadHelper(markup) {
  document.body.innerHTML = markup;
  delete window.__kaziAsanaTaskTimer;
  vi.resetModules();
  const { readFileSync } = await import("node:fs");
  // The helper is a classic browser script with no exports.
  // eslint-disable-next-line no-new-func
  new Function(readFileSync(SCRIPT, "utf8"))();
  await settle();
}

async function settle() {
  // Mounting waits for an animation frame and a mutation callback.
  await new Promise((resolve) => setTimeout(resolve, 50));
}

const STANDARD_PANE = `
  <div class="TaskPane">
    <div class="TaskPane-titleRow"><textarea>Develop browser extension</textarea></div>
    <div class="TaskPaneBody-main"></div>
    <div class="TaskPaneToolbarAnimation-row">
      <div role="button" aria-pressed="false">Mark complete</div>
    </div>
  </div>`;

// Same task pane, but the title is only exposed as an aria-labelled field.
const LABELLED_TITLE_PANE = `
  <div class="TaskPane">
    <div class="TaskPaneBody-main">
      <textarea aria-label="Task Name">Develop browser extension</textarea>
    </div>
    <div class="TaskPaneToolbarAnimation-row">
      <button type="button">Mark complete</button>
    </div>
  </div>`;

beforeEach(() => {
  installChromeStub();
  visibleLayout();
  globalThis.requestAnimationFrame ??= (callback) => setTimeout(callback, 0);
});

afterEach(() => {
  document.body.innerHTML = "";
  delete window.__kaziAsanaTaskTimer;
  delete globalThis.chrome;
});

describe("Asana Start timer button", () => {
  it("mounts beside Mark complete when Asana renders it as a div button", async () => {
    await loadHelper(STANDARD_PANE);

    const button = document.getElementById(BUTTON_ID);
    expect(button).not.toBeNull();
    expect(button.previousElementSibling.textContent).toBe("Mark complete");
    expect(button.textContent).toBe("Start timer");
  });

  it("mounts when the title is only available as an aria-labelled field", async () => {
    await loadHelper(LABELLED_TITLE_PANE);

    expect(document.getElementById(BUTTON_ID)).not.toBeNull();
  });

  it("stays out of the way when Mark complete is not on the page", async () => {
    await loadHelper(
      `<div class="TaskPane"><div class="TaskPaneToolbarAnimation-row"><div role="button">Approve</div></div></div>`,
    );

    expect(document.getElementById(BUTTON_ID)).toBeNull();
  });

  it("sends the open task's title when started", async () => {
    await loadHelper(STANDARD_PANE);

    document.getElementById(BUTTON_ID).click();
    await settle();

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "start",
        task: "Develop browser extension",
      }),
    );
  });

  it("is disabled and labelled for another task while a timer runs elsewhere", async () => {
    storage.timer = {
      id: "t9",
      task: "Something else",
      running: true,
      accumulatedMs: 0,
      startedAt: new Date().toISOString(),
    };
    await loadHelper(STANDARD_PANE);

    const button = document.getElementById(BUTTON_ID);
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe("Timer on another task");
  });

  it("shows the running time for the task on screen", async () => {
    storage.timer = {
      id: "t1",
      task: "Develop browser extension",
      running: true,
      accumulatedMs: 65_000,
      startedAt: new Date().toISOString(),
    };
    await loadHelper(STANDARD_PANE);

    const button = document.getElementById(BUTTON_ID);
    expect(button.disabled).toBe(true);
    expect(button.textContent).toMatch(/^Timer running · 1:0\d$/);
  });
});
