// Publishes signed Kazi Timer packages directly to R2. This deliberately
// avoids committing generated binaries back to main after every release.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const [version, chromePath, firefoxPath] = process.argv.slice(2);
if (!version || !chromePath || !firefoxPath) {
  throw new Error(
    "Usage: node publish-release-artifacts.mjs <version> <chrome-crx> <firefox-xpi>",
  );
}

const accountId =
  process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET_NAME;
const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
const missing = [
  !accountId && "CLOUDFLARE_ACCOUNT_ID (or R2_ACCOUNT_ID)",
  !accessKeyId && "R2_ACCESS_KEY_ID",
  !secretAccessKey && "R2_SECRET_ACCESS_KEY",
  !bucket && "R2_BUCKET_NAME",
  !publicUrl && "R2_PUBLIC_URL",
].filter(Boolean);

if (missing.length) {
  throw new Error(
    `R2 release configuration is incomplete: ${missing.join(", ")}`,
  );
}

const prefix = "extensions/kazi-timer";
const chromeKey = `${prefix}/kazi-timer-${version}.crx`;
const firefoxKey = `${prefix}/firefox/kazi-timer-${version}.xpi`;
const chromeUrl = `${publicUrl}/${chromeKey}`;
const firefoxUrl = `${publicUrl}/${firefoxKey}`;
const firefoxHash = createHash("sha256")
  .update(await readFile(firefoxPath))
  .digest("hex");

const chromeUpdates = `<?xml version="1.0" encoding="UTF-8"?>
<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">
  <app appid="dffnikiadlobakbogmmfjkobjieehcbc">
    <updatecheck codebase="${chromeUrl}" version="${version}" />
  </app>
</gupdate>
`;
const firefoxUpdates = `${JSON.stringify(
  {
    addons: {
      "kazi-timer@growthpad.africa": {
        updates: [
          {
            version,
            update_link: firefoxUrl,
            update_hash: `sha256:${firefoxHash}`,
            applications: { gecko: { strict_min_version: "140.0" } },
          },
        ],
      },
    },
  },
  null,
  2,
)}\n`;

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

async function upload(key, body, contentType, cacheControl) {
  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
  console.log(`Published ${key}`);
}

await upload(
  chromeKey,
  await readFile(chromePath),
  "application/x-chrome-extension",
  "public, max-age=31536000, immutable",
);
await upload(
  firefoxKey,
  await readFile(firefoxPath),
  "application/x-xpinstall",
  "public, max-age=31536000, immutable",
);
await upload(
  `${prefix}/updates.xml`,
  chromeUpdates,
  "application/xml; charset=utf-8",
  "public, max-age=300, must-revalidate",
);
await upload(
  `${prefix}/firefox/updates.json`,
  firefoxUpdates,
  "application/json; charset=utf-8",
  "public, max-age=300, must-revalidate",
);
