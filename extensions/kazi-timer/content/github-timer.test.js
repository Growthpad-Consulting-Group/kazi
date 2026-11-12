// @vitest-environment jsdom
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SCRIPT = resolve(
  process.cwd(),
  "extensions/kazi-timer/content/github-timer.js",
);

let sendMessage;

beforeEach(() => {
  sendMessage = vi.fn(async () => ({
    timer: { id: "github-1", task: "Improve daily logging", running: true },
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
  delete window.__kaziGitHubTimer;
  delete globalThis.chrome;
});

describe("GitHub timer helper", () => {
  it("starts from the visible issue title only", async () => {
    document.body.innerHTML =
      '<h1 data-testid="issue-title">Improve daily logging</h1><article>Private issue discussion</article>';
    const { readFileSync } = await import("node:fs");
    new Function(readFileSync(SCRIPT, "utf8"))();
    await new Promise((resolve) => setTimeout(resolve, 30));

    document.getElementById("kazi-github-start-timer").click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "start",
        task: "Improve daily logging",
        category: "Projects",
      }),
    );
  });
});
