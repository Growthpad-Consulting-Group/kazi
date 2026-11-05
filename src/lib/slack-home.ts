import { supabaseAdmin } from "@/lib/supabase";
import { localClock, weekStartOf } from "@/lib/slack-schedule";
import type { HomeData } from "./slack-home-view";

const TIMEZONE = "Africa/Nairobi";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables
const db = supabaseAdmin as any;

/** Loads counts for the Home tab. Each value is the person's own record, or a team count for managers. */
export async function loadHomeData(
  userId: string,
  now: Date = new Date(),
): Promise<HomeData> {
  const clock = localClock(now, TIMEZONE);
  const week = weekStartOf(clock.date, clock.weekday);
  const from = new Date(now.getTime() - 3_600_000).toISOString();
  const to = new Date(now.getTime() + 24 * 3_600_000).toISOString();
  const dueBy = new Date(now.getTime() + 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [user, meetings, log, checkin, goals, timer, reports] =
    await Promise.all([
      db.from("users").select("name").eq("id", userId).maybeSingle(),
      db
        .from("one_on_ones")
        .select("id")
        .or(`manager_id.eq.${userId},report_id.eq.${userId}`)
        .gte("scheduled_at", from)
        .lte("scheduled_at", to),
      db
        .from("daily_activity_logs")
        .select("entries")
        .eq("user_id", userId)
        .eq("log_date", clock.date)
        .maybeSingle(),
      db
        .from("checkins")
        .select("status")
        .eq("user_id", userId)
        .eq("week_start", week)
        .maybeSingle(),
      db
        .from("goals")
        .select("due_date")
        .eq("owner_id", userId)
        .not("status", "in", "(completed,cancelled)"),
      db
        .from("shared_active_timers")
        .select("timer")
        .eq("user_id", userId)
        .maybeSingle(),
      db
        .from("users")
        .select("id")
        .eq("manager_id", userId)
        .eq("is_active", true),
    ]);

  const openGoals = (goals.data ?? []) as { due_date: string | null }[];
  const reportIds = ((reports.data ?? []) as { id: string }[]).map((r) => r.id);
  let checkinsAwaitingReview: number | null = null;
  if (reportIds.length) {
    const { data: pending } = await db
      .from("checkins")
      .select("user_id")
      .in("user_id", reportIds)
      .eq("week_start", week)
      .eq("status", "submitted");
    checkinsAwaitingReview = (pending ?? []).length;
  }

  return {
    firstName:
      (user.data?.name as string | undefined)?.split(" ")[0] || "there",
    meetingsNext24h: (meetings.data ?? []).length,
    logged: Array.isArray(log.data?.entries) && log.data.entries.length > 0,
    checkinSubmitted: ["submitted", "reviewed"].includes(
      checkin.data?.status ?? "",
    ),
    goalsOpen: openGoals.length,
    goalsDueSoon: openGoals.filter(
      (goal) => goal.due_date && goal.due_date <= dueBy,
    ).length,
    timerRunning: Boolean(timer.data?.timer?.running),
    checkinsAwaitingReview,
  };
}

export type { HomeData } from "./slack-home-view";
