import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";
import type { UserRole } from "@/types/database";

/** Admin and HR can act on anyone's log. A manager can only act on people whose manager they are. */
export async function canActOnDailyLog(session: { user: { id: string; role: UserRole } }, userId: string): Promise<boolean> {
  if (!can(session.user.role, "manage_checkins")) return false;
  if (session.user.role !== "manager") return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- users.manager_id is typed, but keep the lookup next to the check
  const { data } = await (supabaseAdmin as any).from("users").select("manager_id").eq("id", userId).maybeSingle();
  return (data as { manager_id: string | null } | null)?.manager_id === session.user.id;
}
