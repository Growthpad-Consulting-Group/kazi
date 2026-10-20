"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateUserCheckins } from "@/lib/cache/invalidate";
import { getCachedMyCheckins } from "@/lib/cache/queries";
import type { Checkin, CheckinStatus } from "@/types/database";

export type CheckinWithUser = Checkin & {
  users: { name: string; department: string | null; job_title: string | null } | null;
};

export async function getMyCheckins(userId: string): Promise<Checkin[]> {
  return (await getCachedMyCheckins(userId)) as Checkin[];
}

export async function getTeamCheckins(managerId: string): Promise<CheckinWithUser[]> {
  // Get direct reports
  const { data: reports } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("manager_id", managerId);
  const ids = (reports ?? []).map((r) => r.id as string);
  if (!ids.length) return [];

  const { data } = await supabaseAdmin
    .from("checkins")
    .select("*, users(name, department, job_title)")
    .in("user_id", ids)
    .order("week_start", { ascending: false })
    .limit(50);
  return (data ?? []) as unknown as CheckinWithUser[];
}

export async function getCheckin(id: string): Promise<Checkin | null> {
  const { data } = await supabaseAdmin.from("checkins").select("*").eq("id", id).single();
  return data as unknown as Checkin | null;
}

export async function upsertCheckin(
  userId: string,
  weekStart: string,
  fields: { wins?: string | null; priorities?: string | null; blockers?: string | null; mood?: number | null; status?: CheckinStatus }
) {
  const { error } = await supabaseAdmin.from("checkins").upsert(
    { user_id: userId, week_start: weekStart, ...fields },
    { onConflict: "user_id,week_start" }
  );
  if (error) throw new Error(error.message);
  revalidatePath("/pulse/checkins");
  await invalidateUserCheckins(userId);
}

export async function reviewCheckin(
  checkinId: string,
  reviewerId: string,
  comment: string
) {
  const { error } = await supabaseAdmin
    .from("checkins")
    .update({
      manager_comment: comment,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      status: "reviewed" as CheckinStatus,
    })
    .eq("id", checkinId);
  if (error) throw new Error(error.message);
  revalidatePath("/pulse/checkins");
  // The reviewer's comment is stored on the employee's check-in, so the
  // owner's cached check-ins are the ones that went stale.
  const { data: checkin } = await supabaseAdmin
    .from("checkins")
    .select("user_id")
    .eq("id", checkinId)
    .maybeSingle();
  await invalidateUserCheckins((checkin as { user_id: string } | null)?.user_id ?? "");
}
