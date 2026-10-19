/**
 * Creates the first admin user.
 * Usage: npx tsx scripts/seed-admin.ts
 */
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@growthpad.co.ke";
  const password = process.env.ADMIN_PASSWORD ?? "changeme123!";
  const name = process.env.ADMIN_NAME ?? "Admin";

  const hash = await bcrypt.hash(password, 12);

  const { data, error } = await db
    .from("users")
    .upsert({ email, name, password_hash: hash, role: "admin" }, { onConflict: "email" })
    .select("id, email, role")
    .single();

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  console.log("Admin user ready:", data);
}

main();
