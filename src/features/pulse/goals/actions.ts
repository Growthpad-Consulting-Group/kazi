"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateOwnerGoals } from "@/lib/cache/invalidate";
import { getCachedGoals } from "@/lib/cache/queries";
import type { Goal, GoalLevel, GoalStatus } from "@/types/database";

export type GoalWithChildren = Goal & { children?: Goal[] };

export async function getGoals(params?: {
  ownerId?: string;
  level?: GoalLevel;
}): Promise<Goal[]> {
  return getCachedGoals({ ownerId: params?.ownerId, level: params?.level });
}

export async function createGoal(fields: {
  title: string;
  description?: string | null;
  level: GoalLevel;
  owner_id?: string | null;
  parent_id?: string | null;
  due_date?: string | null;
  created_by: string;
}) {
  const { error } = await supabaseAdmin.from("goals").insert(fields);
  if (error) throw new Error(error.message);
  revalidatePath("/pulse/goals");
  await invalidateOwnerGoals(fields.owner_id ?? "");
}

export async function updateGoalProgress(
  id: string,
  progress: number,
  status?: GoalStatus,
) {
  const update: Partial<Goal> = { progress };
  if (status) update.status = status;
  // Read the owner before the write so the right cached list is dropped.
  const ownerId = await goalOwnerId(id);
  const { error } = await supabaseAdmin
    .from("goals")
    .update(update)
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/pulse/goals");
  await invalidateOwnerGoals(ownerId);
}

export async function deleteGoal(id: string) {
  // Read the owner before the row is removed.
  const ownerId = await goalOwnerId(id);
  const { error } = await supabaseAdmin.from("goals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/pulse/goals");
  await invalidateOwnerGoals(ownerId);
}

/** Look up the owner of a goal so only their cached goal list is dropped. */
async function goalOwnerId(id: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("goals")
    .select("owner_id")
    .eq("id", id)
    .maybeSingle();
  return (data as { owner_id: string | null } | null)?.owner_id ?? "";
}
