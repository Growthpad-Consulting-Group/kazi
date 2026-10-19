"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import type { Goal, GoalLevel, GoalStatus } from "@/types/database";

export type GoalWithChildren = Goal & { children?: Goal[] };

export async function getGoals(params?: {
  ownerId?: string;
  level?: GoalLevel;
}): Promise<Goal[]> {
  let q = supabaseAdmin.from("goals").select("*").order("created_at");
  if (params?.ownerId) q = q.eq("owner_id", params.ownerId);
  if (params?.level) q = q.eq("level", params.level);
  const { data } = await q;
  return (data ?? []) as unknown as Goal[];
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
}

export async function updateGoalProgress(id: string, progress: number, status?: GoalStatus) {
  const update: Partial<Goal> = { progress };
  if (status) update.status = status;
  const { error } = await supabaseAdmin.from("goals").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/pulse/goals");
}

export async function deleteGoal(id: string) {
  const { error } = await supabaseAdmin.from("goals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/pulse/goals");
}
