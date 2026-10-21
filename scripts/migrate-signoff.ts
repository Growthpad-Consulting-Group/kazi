/**
 * Signoff → Kazi migration preflight.
 *
 * By default this script is read-only. Its guarded apply mode preserves legacy
 * IDs so it can safely be re-run after a partial transfer.
 *
 * Run with:
 *   npx tsx scripts/migrate-signoff.ts --dry-run
 *   SIGNOFF_BACKUP_CONFIRMED=yes npx tsx scripts/migrate-signoff.ts --apply
 *
 * The Signoff environment is read from SIGNOFF_ENV_FILE (defaulting to the
 * sibling project). It is parsed into in-memory SIGNOFF_* values only; no
 * secrets are printed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config, parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";

type SignoffStaff = { id: string; email: string; full_name: string };
type KaziUser = { id: string; email: string; name: string; is_active: boolean };
type SourceRow = Record<string, unknown>;
type QueryResult = { data: unknown; error: { message: string } | null };
type TargetTable = { upsert: (rows: SourceRow[], options: { onConflict: string }) => PromiseLike<QueryResult> };
type UntypedSupabase = { from: (table: string) => TargetTable };
type SourceSupabase = { from: (table: string) => { select: (columns: string) => PromiseLike<QueryResult> } };

const TABLES = [
  "domains",
  "signature_templates",
  "signature_template_versions",
  "staff",
  "signature_assignments",
  "campaign_experiments",
  "campaigns",
  "campaign_daily_stats",
  "campaign_clicks",
  "media_assets",
  "template_link_clicks",
] as const;

function sourceEnvironment() {
  const sourceFile = process.env.SIGNOFF_ENV_FILE || resolve(process.cwd(), "../gcg-signoff/.env.local");
  try {
    return parse(readFileSync(sourceFile));
  } catch {
    throw new Error(`Could not read Signoff environment file at ${sourceFile}. Set SIGNOFF_ENV_FILE to its .env.local path.`);
  }
}

function emailKey(email: string) {
  return email.trim().toLowerCase();
}

async function readAll(source: SourceSupabase, table: string) {
  const { data, error } = await source.from(table).select("*");
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as SourceRow[];
}

async function upsert(target: UntypedSupabase, table: string, rows: SourceRow[]) {
  if (!rows.length) return 0;
  const { error } = await target.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`${table}: ${error.message}`);
  return rows.length;
}

async function applyImport(
  source: SourceSupabase,
  target: UntypedSupabase,
  usersByEmail: Map<string, KaziUser>,
) {
  const [domains, templates, versions, staff, assignments, experiments, campaigns, dailyStats, campaignClicks, mediaAssets, templateLinkClicks] = await Promise.all(
    TABLES.map((table) => readAll(source, table)),
  );

  // The old encrypted token is not usable in Kazi: it was encrypted with a
  // different key. Domain credentials move separately after re-encryption.
  const safeDomains = domains.map((sourceDomain) => {
    const { cloudflare_api_token_encrypted: oldToken, ...domain } = sourceDomain;
    void oldToken;
    return domain;
  });
  const staffProfiles = staff.map((person) => ({
    ...person,
    user_id: typeof person.email === "string" ? usersByEmail.get(emailKey(person.email))?.id ?? null : null,
  }));
  const signatureAssignments = assignments.map(({ staff_id, ...assignment }) => ({
    ...assignment,
    staff_profile_id: staff_id,
  }));
  const signatureCampaignClicks = campaignClicks.map(({ staff_id, ...click }) => ({
    ...click,
    staff_profile_id: staff_id,
  }));
  const signatureTemplateLinkClicks = templateLinkClicks.map(({ staff_id, ...click }) => ({
    ...click,
    staff_profile_id: staff_id,
  }));

  const results = await Promise.all([
    upsert(target, "signature_domains", safeDomains),
    upsert(target, "signature_templates", templates),
    upsert(target, "signature_campaign_experiments", experiments),
  ]);
  const children = await Promise.all([
    upsert(target, "signature_template_versions", versions),
    upsert(target, "signature_staff_profiles", staffProfiles),
    upsert(target, "signature_campaigns", campaigns),
    // These references intentionally retain their old public URLs until the
    // asset transfer has copied each object and rewritten the URLs.
    upsert(target, "signature_media_assets", mediaAssets),
  ]);
  const dependents = await Promise.all([
    upsert(target, "signature_assignments", signatureAssignments),
    upsert(target, "signature_campaign_daily_stats", dailyStats),
    upsert(target, "signature_campaign_clicks", signatureCampaignClicks),
    upsert(target, "signature_template_link_clicks", signatureTemplateLinkClicks),
  ]);

  return [...results, ...children, ...dependents].reduce((sum, total) => sum + total, 0);
}

async function main() {
  config({ path: resolve(process.cwd(), ".env.local") });
  const sourceEnv = sourceEnvironment();
  const sourceUrl = process.env.SIGNOFF_SUPABASE_URL || sourceEnv.NEXT_PUBLIC_SUPABASE_URL;
  const sourceKey = process.env.SIGNOFF_SUPABASE_SERVICE_ROLE_KEY || sourceEnv.SUPABASE_SERVICE_ROLE_KEY;
  const targetUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const targetKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sourceUrl || !sourceKey || !targetUrl || !targetKey) throw new Error("Source or target Supabase credentials are missing.");

  const source = createClient(sourceUrl, sourceKey, { auth: { persistSession: false } });
  const target = createClient(targetUrl, targetKey, { auth: { persistSession: false } });
  const apply = process.argv.includes("--apply");
  if (apply && process.env.SIGNOFF_BACKUP_CONFIRMED !== "yes") {
    throw new Error("Refusing to import before a source backup is confirmed. Set SIGNOFF_BACKUP_CONFIRMED=yes only after verifying the Signoff backup.");
  }
  const tableCounts = await Promise.all(
    TABLES.map(async (table) => {
      const { count: total, error } = await source.from(table).select("id", { count: "exact", head: true });
      if (error) throw new Error(`${table}: ${error.message}`);
      return [table, total ?? 0] as const;
    }),
  );

  const [{ data: sourceStaff, error: sourceStaffError }, { data: kaziUsers, error: kaziUsersError }] = await Promise.all([
    source.from("staff").select("id, email, full_name").order("email"),
    target.from("users").select("id, email, name, is_active").order("email"),
  ]);
  if (sourceStaffError) throw new Error(`staff: ${sourceStaffError.message}`);
  if (kaziUsersError) throw new Error(`users: ${kaziUsersError.message}`);

  const usersByEmail = new Map((kaziUsers as KaziUser[]).map((user) => [emailKey(user.email), user]));
  const matching = (sourceStaff as SignoffStaff[]).filter((staff) => usersByEmail.has(emailKey(staff.email)));
  const unmatched = (sourceStaff as SignoffStaff[]).filter((staff) => !usersByEmail.has(emailKey(staff.email)));

  console.log(`Signoff → Kazi ${apply ? "import" : "dry run (no data was written)"}\n`);
  for (const [table, total] of tableCounts) console.log(`${table.padEnd(30)} ${total}`);
  console.log(`\nStaff matched to Kazi users      ${matching.length}`);
  console.log(`Staff needing reconciliation     ${unmatched.length}`);
  if (unmatched.length) {
    console.log("\nUnmatched staff (first 20):");
    unmatched.slice(0, 20).forEach((staff) => console.log(`- ${staff.full_name} <${staff.email}>`));
  }
  if (!apply) {
    console.log("\nBefore apply mode: confirm a source backup, migrate storage assets, re-encrypt domain secrets, and reconcile unmatched staff.");
    return;
  }

  const imported = await applyImport(source as unknown as SourceSupabase, target as unknown as UntypedSupabase, usersByEmail);
  console.log(`\nImported or updated ${imported} records. Source encrypted domain tokens were not copied.`);
  console.log("Next: copy storage assets, rewrite old URLs, re-encrypt domain credentials, then re-run this command to verify idempotency.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
