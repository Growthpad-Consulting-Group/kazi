/**
 * Provisions Kazi accounts for imported Signoff staff and links each profile.
 *
 * Usage:
 *   SIGNATURE_STAFF_TEMP_PASSWORD='…' npx tsx scripts/provision-imported-signoff-staff.ts --apply --deactivate-demo
 */
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { resolve } from "node:path";

type SignatureProfile = {
  id: string;
  email: string;
  full_name: string;
  department: string | null;
  role_title: string | null;
  user_id: string | null;
};

type User = { id: string; email: string; role: string; is_active: boolean };

const DEMO_EMAILS = [
  "mkt.mgr@growthpad.africa",
  "hr@growthpad.africa",
  "mkt1@growthpad.africa",
  "ops1@growthpad.africa",
  "dev1@growthpad.africa",
  "interviewer@growthpad.africa",
  "eng.mgr@growthpad.africa",
  "fin1@growthpad.africa",
  "dev2@growthpad.africa",
  "des1@growthpad.africa",
] as const;

function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}

async function main() {
  config({ path: resolve(process.cwd(), ".env.local") });
  const apply = process.argv.includes("--apply");
  const deactivateDemo = process.argv.includes("--deactivate-demo");
  const temporaryPassword = process.env.SIGNATURE_STAFF_TEMP_PASSWORD;
  if (apply && (!temporaryPassword || temporaryPassword.length < 12)) {
    throw new Error("Set a temporary password of at least 12 characters in SIGNATURE_STAFF_TEMP_PASSWORD.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Kazi Supabase credentials are missing.");
  const database = createClient(url, serviceKey, { auth: { persistSession: false } });
  const [{ data: profiles, error: profilesError }, { data: users, error: usersError }] = await Promise.all([
    database.from("signature_staff_profiles").select("id, email, full_name, department, role_title, user_id").order("email"),
    database.from("users").select("id, email, role, is_active").order("email"),
  ]);
  if (profilesError) throw new Error(`signature_staff_profiles: ${profilesError.message}`);
  if (usersError) throw new Error(`users: ${usersError.message}`);

  const profilesToProvision = (profiles as SignatureProfile[]).filter((profile) => !profile.user_id);
  const usersByEmail = new Map((users as User[]).map((user) => [normaliseEmail(user.email), user]));
  const existingMatches = profilesToProvision.filter((profile) => usersByEmail.has(normaliseEmail(profile.email)));
  const newAccounts = profilesToProvision.filter((profile) => !usersByEmail.has(normaliseEmail(profile.email)));

  console.log(`Imported staff profiles: ${profilesToProvision.length}`);
  console.log(`Accounts to create: ${newAccounts.length}`);
  console.log(`Existing accounts to link: ${existingMatches.length}`);
  console.log(`Demo accounts to deactivate: ${deactivateDemo ? DEMO_EMAILS.length : 0}`);
  if (!apply) {
    console.log("Dry run only. Pass --apply after setting SIGNATURE_STAFF_TEMP_PASSWORD.");
    return;
  }

  const passwordHash = await bcrypt.hash(temporaryPassword!, 12);
  const { data: created, error: createError } = await database
    .from("users")
    .insert(newAccounts.map((profile) => ({
      email: normaliseEmail(profile.email),
      name: profile.full_name,
      password_hash: passwordHash,
      role: "employee",
      department: profile.department,
      job_title: profile.role_title,
      is_active: true,
    })))
    .select("id, email");
  if (createError) throw new Error(`users: ${createError.message}`);

  const linksByEmail = new Map<string, string>();
  for (const user of users as User[]) linksByEmail.set(normaliseEmail(user.email), user.id);
  for (const user of created ?? []) linksByEmail.set(normaliseEmail(user.email), user.id);

  for (const profile of profilesToProvision) {
    const userId = linksByEmail.get(normaliseEmail(profile.email));
    if (!userId) throw new Error(`No Kazi account was available for ${profile.email}.`);
    const { error } = await database.from("signature_staff_profiles").update({ user_id: userId }).eq("id", profile.id);
    if (error) throw new Error(`Could not link ${profile.email}: ${error.message}`);
  }

  if (deactivateDemo) {
    const { error } = await database.from("users").update({ is_active: false }).in("email", [...DEMO_EMAILS]);
    if (error) throw new Error(`Could not deactivate demo accounts: ${error.message}`);
  }

  console.log(`Created ${created?.length ?? 0} Kazi accounts and linked ${profilesToProvision.length} imported staff profiles.`);
  if (deactivateDemo) console.log(`Deactivated ${DEMO_EMAILS.length} named demo accounts. The analytics administrator was preserved.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
