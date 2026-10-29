/**
 * Sync every active, assigned Growthpad signature that has not already been
 * confirmed in Gmail. Run without --apply to inspect the exact recipient list.
 *
 * Usage: npx tsx scripts/sync-signature-staff-gmail.ts --apply --resync --exclude=emmanuel.eshun@growthpad.net
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { resolve } from "node:path";
import { pushSignatureToGmail } from "../src/features/signatures/lib/gmailSync";

type Profile = {
  id: string;
  email: string;
  full_name: string;
  role_title: string | null;
  department: string | null;
  phone: string | null;
  mobile: string | null;
  photo_url: string | null;
  status: string;
};
type Assignment = {
  staff_profile_id: string;
  template_id: string;
  gmail_sync_status: string;
};
type Template = { id: string; html: string };

function render(html: string, profile: Profile) {
  return html.replace(/{{\s*([a-z_]+)\s*}}/gi, (_match, key: keyof Profile) =>
    String(profile[key] ?? ""),
  );
}

async function main() {
  config({ path: resolve(process.cwd(), ".env.local") });
  const apply = process.argv.includes("--apply");
  const resync = process.argv.includes("--resync");
  const excludedEmails = new Set(
    process.argv
      .filter((argument) => argument.startsWith("--exclude="))
      .map((argument) =>
        argument.slice("--exclude=".length).trim().toLowerCase(),
      ),
  );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey)
    throw new Error("Kazi Supabase credentials are missing.");
  const database = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  const [profilesResult, assignmentsResult, templatesResult] =
    await Promise.all([
      database
        .from("signature_staff_profiles")
        .select(
          "id,email,full_name,role_title,department,phone,mobile,photo_url,status",
        )
        .eq("status", "active")
        .order("email"),
      database
        .from("signature_assignments")
        .select("staff_profile_id,template_id,gmail_sync_status"),
      database.from("signature_templates").select("id,html"),
    ]);
  if (profilesResult.error)
    throw new Error(`Profiles: ${profilesResult.error.message}`);
  if (assignmentsResult.error)
    throw new Error(`Assignments: ${assignmentsResult.error.message}`);
  if (templatesResult.error)
    throw new Error(`Templates: ${templatesResult.error.message}`);

  const assignments = new Map(
    (assignmentsResult.data as Assignment[]).map((assignment) => [
      assignment.staff_profile_id,
      assignment,
    ]),
  );
  const templates = new Map(
    (templatesResult.data as Template[]).map((template) => [
      template.id,
      template,
    ]),
  );
  const targets = (profilesResult.data as Profile[]).flatMap((profile) => {
    const assignment = assignments.get(profile.id);
    const template = assignment
      ? templates.get(assignment.template_id)
      : undefined;
    const eligible =
      assignment &&
      template &&
      (resync || assignment.gmail_sync_status !== "synced") &&
      !excludedEmails.has(profile.email.toLowerCase());
    return eligible ? [{ profile, assignment, template }] : [];
  });
  const skipped = (profilesResult.data as Profile[]).filter(
    (profile) =>
      !assignments.has(profile.id) ||
      !templates.has(assignments.get(profile.id)?.template_id ?? ""),
  );

  console.log(
    `Eligible active staff: ${(profilesResult.data as Profile[]).length}`,
  );
  console.log(
    `Ready to sync: ${targets.length}${resync ? " (including prior migrated sync statuses)" : ""}`,
  );
  for (const target of targets) console.log(`- ${target.profile.email}`);
  if (skipped.length)
    console.log(
      `Skipped (no assignment/template): ${skipped.map((profile) => profile.email).join(", ")}`,
    );
  if (!apply) {
    console.log("Dry run only. Pass --apply to write signatures to Gmail.");
    return;
  }

  let succeeded = 0;
  const failures: string[] = [];
  for (const target of targets) {
    try {
      await pushSignatureToGmail(
        target.profile.email,
        render(target.template.html, target.profile),
      );
      const { error } = await database
        .from("signature_assignments")
        .update({
          gmail_sync_status: "synced",
          gmail_sync_error: null,
          last_gmail_synced_at: new Date().toISOString(),
        })
        .eq("staff_profile_id", target.profile.id);
      if (error) throw new Error(error.message);
      succeeded += 1;
      console.log(`Synced ${target.profile.email}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gmail sync failed.";
      await database
        .from("signature_assignments")
        .update({ gmail_sync_status: "error", gmail_sync_error: message })
        .eq("staff_profile_id", target.profile.id);
      failures.push(`${target.profile.email}: ${message}`);
      console.error(`Failed ${target.profile.email}: ${message}`);
    }
  }
  console.log(`Finished: ${succeeded}/${targets.length} synced.`);
  if (failures.length) {
    console.error(`Failures:\n${failures.join("\n")}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
