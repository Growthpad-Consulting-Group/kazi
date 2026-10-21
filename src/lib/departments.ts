import { supabaseAdmin } from "@/lib/supabase";

/**
 * Resolves a UI/API department value to the organisation's canonical label.
 * Existing records keep their current value; new writes must refer to a row in
 * Settings → Departments, preventing near-duplicate departments by casing or
 * whitespace.
 */
export async function canonicalDepartment(value: string | null | undefined): Promise<string | null> {
  const name = value?.trim().replace(/\s+/g, " ") ?? "";
  if (!name) return null;
  const { data, error } = await supabaseAdmin
    .from("departments")
    .select("name")
    .ilike("name", name.replace(/[%_\\]/g, "\\$&"))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Choose an existing department from Settings → Departments before saving “${name}”.`);
  return data.name;
}
