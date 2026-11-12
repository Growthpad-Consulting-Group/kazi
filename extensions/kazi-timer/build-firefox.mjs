// Builds the Firefox version of Kazi Timer from the Chrome source.
//
// Firefox differs from Chrome in three ways this script handles:
//   - it runs the background as classic scripts, not a service worker,
//   - it needs a fixed add-on ID (browser_specific_settings.gecko),
//   - it ignores the Chrome update_url, so Mozilla signing delivers updates.
// Run: node build-firefox.mjs   (writes build/firefox and build/kazi-timer-firefox.zip)

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "build", "firefox");
const zip = join(here, "build", "kazi-timer-firefox.zip");

const FILES = [
  "background.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "options.html",
  "options.css",
  "options.js",
  "content",
  "icons",
];
const EXCLUDE = /\.test\.js$/;
const FIREFOX_UPDATE_URL =
  "https://kazi.growthpad.africa/extensions/kazi-timer/firefox/updates.json";

const chromeManifest = JSON.parse(
  await readFile(join(here, "manifest.json"), "utf8"),
);

const rest = Object.fromEntries(
  Object.entries(chromeManifest).filter(([key]) => key !== "update_url"),
);
const manifest = {
  ...rest,
  background: { scripts: ["background.js"] },
  browser_specific_settings: {
    gecko: {
      id: "kazi-timer@growthpad.africa",
      strict_min_version: "140.0",
      // What the add-on sends off the device. authenticationInfo: the Kazi
      // sign-in token. websiteContent: the task title read on Asana and the
      // activity names staff type. Confirm with the privacy owner before
      // submitting.
      // Firefox checks this address for updates to self-distributed add-ons.
      update_url: FIREFOX_UPDATE_URL,
      data_collection_permissions: {
        required: ["authenticationInfo", "websiteContent"],
      },
    },
    // data_collection_permissions needs Firefox for Android 142 or later.
    gecko_android: { strict_min_version: "142.0" },
  },
};

// Firefox checks that each icon matches its declared size. Canvas keeps this
// release step portable across local macOS and GitHub's Linux runners.
const SIZES = [16, 32, 48, 128];

await rm(join(here, "build"), { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const file of FILES) {
  await cp(join(here, file), join(out, file), {
    recursive: true,
    filter: (source) => !EXCLUDE.test(source),
  });
}
const sourceIcon = await loadImage(join(here, "icons", "kazi.png"));
for (const size of SIZES) {
  const canvas = createCanvas(size, size);
  const context = canvas.getContext("2d");
  context.drawImage(sourceIcon, 0, 0, size, size);
  await writeFile(
    join(out, "icons", `kazi-${size}.png`),
    await canvas.encode("png"),
  );
}
manifest.icons = Object.fromEntries(
  SIZES.map((size) => [String(size), `icons/kazi-${size}.png`]),
);
manifest.action.default_icon = manifest.icons;

await writeFile(
  join(out, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

await rm(zip, { force: true });
await run("zip", ["-qr", zip, "."], { cwd: out });
console.log(`Built ${out}`);
console.log(`Packed ${zip}`);
