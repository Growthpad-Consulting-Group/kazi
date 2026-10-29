/**
 * Copies Signoff signature assets to Kazi R2 and rewrites stored URLs.
 *
 * Default: read-only inventory.
 * Apply: SIGNOFF_BACKUP_CONFIRMED=yes npx tsx scripts/migrate-signoff-assets.ts --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { config, parse } from "dotenv";

type Row = Record<string, unknown>;
type QueryResult = { data: unknown; error: { message: string } | null };
type Table = {
  select: (columns: string) => PromiseLike<QueryResult>;
  upsert: (
    rows: Row[],
    options: { onConflict: string },
  ) => PromiseLike<QueryResult>;
};
type Database = { from: (table: string) => Table };

const STORAGE_BUCKET = process.env.SIGNOFF_STORAGE_BUCKET || "signature-assets";
const R2_PREFIX = "signatures/migrated";

function sourceEnvironment() {
  const sourceFile =
    process.env.SIGNOFF_ENV_FILE ||
    resolve(process.cwd(), "../gcg-signoff/.env.local");
  try {
    return parse(readFileSync(sourceFile));
  } catch {
    throw new Error(
      `Could not read Signoff environment file at ${sourceFile}. Set SIGNOFF_ENV_FILE to its .env.local path.`,
    );
  }
}

function rewriteUrls(value: unknown, urls: Map<string, string>): unknown {
  if (typeof value === "string") {
    let rewritten = value;
    for (const [from, to] of urls) rewritten = rewritten.replaceAll(from, to);
    return rewritten;
  }
  if (Array.isArray(value)) return value.map((item) => rewriteUrls(item, urls));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        rewriteUrls(item, urls),
      ]),
    );
  }
  return value;
}

async function selectRows(database: Database, table: string) {
  const { data, error } = await database.from(table).select("*");
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as Row[];
}

async function upsertRows(database: Database, table: string, rows: Row[]) {
  if (!rows.length) return;
  const { error } = await database
    .from(table)
    .upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function main() {
  config({ path: resolve(process.cwd(), ".env.local") });
  const sourceEnv = sourceEnvironment();
  const sourceUrl =
    process.env.SIGNOFF_SUPABASE_URL || sourceEnv.NEXT_PUBLIC_SUPABASE_URL;
  const sourceKey =
    process.env.SIGNOFF_SUPABASE_SERVICE_ROLE_KEY ||
    sourceEnv.SUPABASE_SERVICE_ROLE_KEY;
  const targetUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const targetKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  const bucket = process.env.R2_BUCKET_NAME;
  const apply = process.argv.includes("--apply");

  if (!sourceUrl || !sourceKey || !targetUrl || !targetKey)
    throw new Error("Source or target Supabase credentials are missing.");
  if (apply && process.env.SIGNOFF_BACKUP_CONFIRMED !== "yes")
    throw new Error(
      "Refusing to copy assets before a source backup is confirmed.",
    );
  if (apply && (!publicUrl || !bucket))
    throw new Error(
      "R2_PUBLIC_URL and R2_BUCKET_NAME are required to copy assets.",
    );

  const source = createClient(sourceUrl, sourceKey, {
    auth: { persistSession: false },
  });
  const target = createClient(targetUrl, targetKey, {
    auth: { persistSession: false },
  });
  const sourceDb = source as unknown as Database;
  const targetDb = target as unknown as Database;
  const mediaAssets = await selectRows(sourceDb, "media_assets");

  console.log(
    `Signoff asset ${apply ? "import" : "dry run (no assets were copied)"}`,
  );
  console.log(`Storage bucket: ${STORAGE_BUCKET}`);
  console.log(`Assets to copy: ${mediaAssets.length}`);
  if (!apply) return;

  const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  const urlMap = new Map<string, string>();
  const migratedAssets: Row[] = [];

  for (const asset of mediaAssets) {
    const sourcePath =
      typeof asset.path === "string" ? asset.path.replace(/^\/+/, "") : "";
    const oldUrl = typeof asset.public_url === "string" ? asset.public_url : "";
    if (!sourcePath || !oldUrl)
      throw new Error(`Invalid media asset record ${String(asset.id)}.`);

    const { data, error } = await source.storage
      .from(STORAGE_BUCKET)
      .download(sourcePath);
    if (error || !data)
      throw new Error(
        `Could not download ${sourcePath}: ${error?.message ?? "empty response"}`,
      );
    const targetPath = `${R2_PREFIX}/${sourcePath}`;
    const targetUrlForAsset = `${publicUrl}/${targetPath}`;
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: targetPath,
        Body: Buffer.from(await data.arrayBuffer()),
        ContentType: data.type || "application/octet-stream",
      }),
    );
    urlMap.set(oldUrl, targetUrlForAsset);
    migratedAssets.push({
      ...asset,
      path: targetPath,
      public_url: targetUrlForAsset,
    });
  }

  await upsertRows(targetDb, "signature_media_assets", migratedAssets);
  const [templates, versions, staffProfiles, campaigns] = await Promise.all([
    selectRows(targetDb, "signature_templates"),
    selectRows(targetDb, "signature_template_versions"),
    selectRows(targetDb, "signature_staff_profiles"),
    selectRows(targetDb, "signature_campaigns"),
  ]);
  await Promise.all([
    upsertRows(
      targetDb,
      "signature_templates",
      templates.map((row) => rewriteUrls(row, urlMap) as Row),
    ),
    upsertRows(
      targetDb,
      "signature_template_versions",
      versions.map((row) => rewriteUrls(row, urlMap) as Row),
    ),
    upsertRows(
      targetDb,
      "signature_staff_profiles",
      staffProfiles.map((row) => rewriteUrls(row, urlMap) as Row),
    ),
    upsertRows(
      targetDb,
      "signature_campaigns",
      campaigns.map((row) => rewriteUrls(row, urlMap) as Row),
    ),
  ]);

  console.log(
    `Copied ${migratedAssets.length} assets to ${bucket} and rewrote Kazi URL references.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
