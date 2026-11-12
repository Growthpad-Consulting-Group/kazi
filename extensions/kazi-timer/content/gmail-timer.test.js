// @vitest-environment jsdom
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SCRIPT = resolve(
  process.cwd(),
  "extensions/kazi-timer/content/gmail-timer.js",
);

let sendMessage;

beforeEach(() => {
  sendMessage = vi.fn(async () => ({
    timer: {
      id: "gmail-1",
      task: "Job Advert: Manager, Corporate Credit Approval",
      running: true,
      accumulatedMs: 0,
      startedAt: new Date().toISOString(),
    },
  }));
  globalThis.chrome = {
    runtime: { sendMessage },
    storage: {
      local: {
        get: vi.fn(async () => ({ timer: null })),
      },
      onChanged: { addListener: vi.fn() },
    },
  };
  Element.prototype.getBoundingClientRect = () => ({ width: 120, height: 24 });
  globalThis.requestAnimationFrame ??= (callback) => setTimeout(callback, 0);
});

afterEach(() => {
  document.body.innerHTML = "";
  delete window.__kaziGmailTimer;
  delete globalThis.chrome;
});

describe("Gmail timer helper", () => {
  it("reads only the displayed subject when the staff member starts a timer", async () => {
    document.body.innerHTML =
      '<main role="main"><h2 class="hP">Job Advert: Manager, Corporate Credit Approval</h2><p>Private email body</p></main>';
    const { readFileSync } = await import("node:fs");
    // The helper is a classic browser script with no exports.
    new Function(readFileSync(SCRIPT, "utf8"))();
    await new Promise((resolve) => setTimeout(resolve, 30));

    document.getElementById("kazi-gmail-start-timer").click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "start",
        task: "Job Advert: Manager, Corporate Credit Approval",
      }),
    );
  });

  it("moves the action to Gmail's next message subject without a page reload", async () => {
    document.body.innerHTML =
      '<main role="main"><h2 class="hP">First email subject</h2></main>';
    const { readFileSync } = await import("node:fs");
    new Function(readFileSync(SCRIPT, "utf8"))();
    await new Promise((resolve) => setTimeout(resolve, 30));

    const nextHeading = document.createElement("h2");
    nextHeading.className = "hP";
    nextHeading.textContent = "Next email subject";
    document.querySelector('[role="main"]').replaceChildren(nextHeading);
    await new Promise((resolve) => setTimeout(resolve, 30));

    const button = document.getElementById("kazi-gmail-start-timer");
    expect(button.previousElementSibling).toBe(nextHeading);
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ task: "Next email subject" }),
    );
  });
});
