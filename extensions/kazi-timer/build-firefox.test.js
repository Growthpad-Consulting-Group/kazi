import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const here = resolve(process.cwd(), "extensions/kazi-timer");
let manifest;

beforeAll(() => {
  execFileSync("node", [resolve(here, "build-firefox.mjs")], {
    stdio: "ignore",
  });
  manifest = JSON.parse(
    readFileSync(resolve(here, "build/firefox/manifest.json"), "utf8"),
  );
});

describe("Firefox build", () => {
  it("runs the background as scripts, not a service worker", () => {
    expect(manifest.background).toEqual({ scripts: ["background.js"] });
  });

  it("declares a fixed add-on ID and drops the Chrome update URL", () => {
    expect(manifest.browser_specific_settings.gecko.id).toBe(
      "kazi-timer@growthpad.africa",
    );
    expect(manifest.update_url).toBeUndefined();
  });

  it("ships icons at the sizes it declares", () => {
    expect(Object.keys(manifest.icons)).toEqual(["16", "32", "48", "128"]);
  });

  it("keeps the same permissions as the Chrome build", () => {
    const chrome = JSON.parse(
      readFileSync(resolve(here, "manifest.json"), "utf8"),
    );
    expect(manifest.permissions).toEqual(chrome.permissions);
    expect(manifest.host_permissions).toEqual(chrome.host_permissions);
  });

  it("leaves out test files", () => {
    const files = execFileSync("find", [
      resolve(here, "build/firefox"),
      "-name",
      "*.test.js",
    ]).toString();
    expect(files.trim()).toBe("");
  });
});
