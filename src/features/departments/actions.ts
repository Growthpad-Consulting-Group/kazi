"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";
import { getCachedDepartments } from "@/lib/cache/queries";
import { invalidateTables } from "@/lib/cache/invalidate";

export async function getDepartments(): Promise<string[]> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");

  return getCachedDepartments();
}

/** Creates a department, or returns the existing one (case-insensitive match). */
export async function createDepartment(rawName: string): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_departments")) throw new Error("Forbidden");

  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Department name is required");

  const { data: existing } = await supabaseAdmin
    .from("departments")
    .select("name")
    .ilike("name", name.replace(/[%_\\]/g, "\\$&"))
    .maybeSingle();
  if (existing) return existing.name;

  const { data, error } = await supabaseAdmin
    .from("departments")
    .insert({ name })
    .select("name")
    .single();

  if (error) throw new Error(error.message);
  await invalidateTables("departments");
  return data.name;
}

export interface DepartmentRow {
  id: string;
  name: string;
  jobs: number;
  people: number;
}

export async function getDepartmentsWithUsage(): Promise<DepartmentRow[]> {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_departments")) throw new Error("Forbidden");

  const [{ data: depts, error }, { data: jobs }, { data: users }] = await Promise.all([
    supabaseAdmin.from("departments").select("id, name").order("name", { ascending: true }),
    supabaseAdmin.from("jobs").select("department"),
    supabaseAdmin.from("users").select("department"),
  ]);
  if (error) throw new Error(error.message);

  const count = (rows: { department: string | null }[] | null) => {
    const map = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!r.department) continue;
      const k = r.department.toLowerCase();
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  };
  const jobCounts = count(jobs);
  const userCounts = count(users);

  return (depts ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    jobs: jobCounts.get(d.name.toLowerCase()) ?? 0,
    people: userCounts.get(d.name.toLowerCase()) ?? 0,
  }));
}

/** Renames a department and updates every job/user that uses the old name. */
export async function renameDepartment(id: string, rawName: string): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_departments")) throw new Error("Forbidden");

  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Department name is required");

  // Single database function = single transaction: all three updates or none.
  const { data, error } = await supabaseAdmin.rpc("rename_department", {
    p_id: id,
    p_name: name,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/settings/departments");
  revalidatePath("/hire/jobs");
  revalidatePath("/people");
  await invalidateTables("departments");
  return data as string;
}

/** Deletes a department only when no job or person uses it. */
export async function deleteDepartment(id: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_departments")) throw new Error("Forbidden");

  const { data: current } = await supabaseAdmin
    .from("departments")
    .select("name")
    .eq("id", id)
    .single();
  if (!current) throw new Error("Department not found");

  const [{ count: jobs }, { count: people }] = await Promise.all([
    supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("department", current.name),
    supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq("department", current.name),
  ]);
  if ((jobs ?? 0) + (people ?? 0) > 0) {
    throw new Error(`In use by ${jobs ?? 0} job(s) and ${people ?? 0} person(s) — rename it or reassign them first`);
  }

  const { error } = await supabaseAdmin.from("departments").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/departments");
  await invalidateTables("departments");
}

