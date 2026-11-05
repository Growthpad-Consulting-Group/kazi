// Updates the self-hosted Chrome and Firefox update manifests after a signed
// Kazi Timer release. This script deliberately receives only artifact paths;
// it never sees signing credentials.

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const [version, xpiPath] = process.argv.slice(2);
if (!version || !xpiPath) {
  throw new Error(
    "Usage: node update-release-manifests.mjs <version> <xpi-path>",
  );
}

const chromeUpdates = new URL(
  "../../public/extensions/kazi-timer/updates.xml",
  import.meta.url,
);
const firefoxUpdates = new URL(
  "../../public/extensions/kazi-timer/firefox/updates.json",
  import.meta.url,
);
const xml = await readFile(chromeUpdates, "utf8");
const nextXml = xml.replace(/version="[^"]+"/, `version="${version}"`);
if (nextXml === xml) throw new Error("Chrome update manifest has no version");
await writeFile(chromeUpdates, nextXml);

const manifest = JSON.parse(await readFile(firefoxUpdates, "utf8"));
const addonId = "kazi-timer@growthpad.africa";
const updates = manifest.addons?.[addonId]?.updates;
if (!Array.isArray(updates))
  throw new Error("Firefox update manifest is invalid");
const hash = createHash("sha256")
  .update(await readFile(xpiPath))
  .digest("hex");
const release = {
  version,
  update_link: `https://kazi.growthpad.africa/extensions/kazi-timer/firefox/kazi-timer-${version}.xpi`,
  update_hash: `sha256:${hash}`,
  applications: { gecko: { strict_min_version: "140.0" } },
};
manifest.addons[addonId].updates = [
  release,
  ...updates.filter((item) => item.version !== version),
];
await writeFile(firefoxUpdates, `${JSON.stringify(manifest, null, 2)}\n`);
