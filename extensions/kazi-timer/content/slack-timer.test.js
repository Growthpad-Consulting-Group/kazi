// @vitest-environment jsdom
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SCRIPT = resolve(
  process.cwd(),
  "extensions/kazi-timer/content/slack-timer.js",
);

let sendMessage;

beforeEach(() => {
  sendMessage = vi.fn(async () => ({
    timer: { id: "slack-1", task: "Slack: company-updates", running: true },
  }));
  globalThis.chrome = {
    runtime: { sendMessage },
    storage: {
      local: { get: vi.fn(async () => ({ timer: null })) },
      onChanged: { addListener: vi.fn() },
    },
  };
  Element.prototype.getBoundingClientRect = () => ({ width: 120, height: 24 });
  globalThis.requestAnimationFrame ??= (callback) => setTimeout(callback, 0);
});

afterEach(() => {
  document.body.innerHTML = "";
  delete window.__kaziSlackTimer;
  delete globalThis.chrome;
});

describe("Slack timer helper", () => {
  it("starts from the active conversation label only", async () => {
    document.body.innerHTML =
      '<header data-qa="channel_name">company-updates</header><article>Private Slack message</article>';
    const { readFileSync } = await import("node:fs");
    new Function(readFileSync(SCRIPT, "utf8"))();
    await new Promise((resolve) => setTimeout(resolve, 30));

    document.getElementById("kazi-slack-start-timer").click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "start",
        task: "Slack: company-updates",
        category: "Meetings",
      }),
    );
  });
});
