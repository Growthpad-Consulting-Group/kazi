import { supabaseAdmin } from "@/lib/supabase";
import type { Goal, GoalLevel, UserRole } from "@/types/database";

export type GoalActor = { id: string; role: UserRole };

export function canCreateGoalLevel(role: UserRole, level: GoalLevel) {
  if (["admin", "hr"].includes(role)) return true;
  if (role === "manager") return level !== "company";
  return level === "individual";
}

export async function isDirectReport(managerId: string, userId: string) {
  if (managerId === userId) return true;
  const { data } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", userId)
    .eq("manager_id", managerId)
    .maybeSingle();
  return Boolean(data);
}

export async function canManageGoal(
  actor: GoalActor,
  goal: Pick<Goal, "level" | "owner_id" | "created_by">,
) {
  if (["admin", "hr"].includes(actor.role)) return true;
  if (actor.role === "manager") {
    if (goal.level === "company") return false;
    if (goal.level === "team") return goal.created_by === actor.id;
    return goal.owner_id ? isDirectReport(actor.id, goal.owner_id) : false;
  }
  return goal.level === "individual" && goal.owner_id === actor.id;
}

/** Company and team outcomes can be used as alignment context without granting edit rights. */
export async function canAlignToParentGoal(
  actor: GoalActor,
  goal: Pick<Goal, "level" | "owner_id" | "created_by">,
) {
  if (goal.level === "company") return true;
  if (actor.role === "employee") return goal.level === "team";
  return canManageGoal(actor, goal);
}
