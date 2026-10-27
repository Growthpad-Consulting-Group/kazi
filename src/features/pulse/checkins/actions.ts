"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateUserCheckins } from "@/lib/cache/invalidate";
import { getCachedMyCheckins } from "@/lib/cache/queries";
import type { Checkin, CheckinStatus } from "@/types/database";

export type DailyWeekSummary = { daysLogged: number; totalMinutes: number; tasks: string[] };

export type CheckinWithUser = Checkin & {
  users: { name: string; department: string | null; job_title: string | null } | null;
};

export async function getMyCheckins(userId: string): Promise<Checkin[]> {
  return (await getCachedMyCheckins(userId)) as Checkin[];
}

export async function getDailyWeekSummary(userId: string, weekStart: string): Promise<DailyWeekSummary> {
  const end = new Date(`${weekStart}T12:00:00`); end.setDate(end.getDate() + 4);
  const weekEnd = end.toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from("daily_activity_logs")
    .select("entries")
    .eq("user_id", userId)
    .gte("log_date", weekStart)
    .lte("log_date", weekEnd);
  if (error) console.error("[getDailyWeekSummary] error:", error.message);
  const rows = (data ?? []) as unknown as { entries: { task?: string; minutes?: number }[] }[];
  return {
    daysLogged: rows.filter((row) => row.entries?.length).length,
    totalMinutes: rows.reduce((total, row) => total + (row.entries ?? []).reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0), 0),
    tasks: rows.flatMap((row) => row.entries ?? []).map((entry) => entry.task?.trim()).filter((task): task is string => Boolean(task)),
  };
}

export async function getTeamCheckins(managerId: string, organisationWide = false): Promise<CheckinWithUser[]> {
  const reportQuery = supabaseAdmin.from("users").select("id").eq("is_active", true);
  const { data: reports } = organisationWide ? await reportQuery : await reportQuery.eq("manager_id", managerId);
  const ids = (reports ?? []).map((r) => r.id as string);
  if (!ids.length) return [];

  const { data, error } = await supabaseAdmin
    .from("checkins")
    .select("*, users!checkins_user_id_fkey(name, department, job_title)")
    .in("user_id", ids)
    .order("week_start", { ascending: false })
    .limit(100);
  if (error) console.error("[getTeamCheckins] error:", error.message);
  return (data ?? []) as unknown as CheckinWithUser[];
}

export async function getTeamDailyLogSummary(managerId: string, weekStart: string, organisationWide = false) {
  const reportQuery = supabaseAdmin.from("users").select("id").eq("is_active", true);
  const { data: reports } = organisationWide ? await reportQuery : await reportQuery.eq("manager_id", managerId);
  const ids = (reports ?? []).map((report) => report.id as string);
  if (!ids.length) return { staffLogged: 0, daysLogged: 0, totalMinutes: 0 };
  const end = new Date(`${weekStart}T12:00:00`); end.setDate(end.getDate() + 4);
  const weekEnd = end.toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from("daily_activity_logs")
    .select("user_id, entries")
    .in("user_id", ids)
    .gte("log_date", weekStart)
    .lte("log_date", weekEnd);
  if (error) console.error("[getTeamDailyLogSummary] error:", error.message);
  const rows = (data ?? []) as unknown as { user_id: string; entries: { minutes?: number }[] }[];
  return {
    staffLogged: new Set(rows.filter((row) => row.entries?.length).map((row) => row.user_id)).size,
    daysLogged: rows.filter((row) => row.entries?.length).length,
    totalMinutes: rows.reduce((total, row) => total + (row.entries ?? []).reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0), 0),
  };
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
