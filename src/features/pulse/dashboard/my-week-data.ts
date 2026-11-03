import { supabaseAdmin } from "@/lib/supabase";
import { loadCompletedAsanaTasks } from "@/lib/asana-completed-tasks";
import type { DailyLogEntry } from "@/features/pulse/daily-log/constants";
import {
  averageGoalProgress,
  computeStreak,
  countWorkdaysLogged,
  shiftDate,
  type MyWeekSummary,
} from "./my-week";

const STREAK_LOOKBACK_DAYS = 60;

/**
 * Builds the employee's own weekly momentum. Everything here is scoped to the
 * signed-in user; Asana is only read when the user has connected it.
 */
export async function loadMyWeek({
  userId,
  weekStart,
  today,
  goals,
}: {
  userId: string;
  weekStart: string;
  today: string;
  goals: { progress: number }[];
}): Promise<MyWeekSummary> {
  const weekEnd = shiftDate(weekStart, 6);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- daily_activity_logs is typed without the newest columns
  const { data: logs } = await (supabaseAdmin as any)
    .from("daily_activity_logs")
    .select("log_date, entries")
    .eq("user_id", userId)
    .gte("log_date", shiftDate(today, -STREAK_LOOKBACK_DAYS))
    .lte("log_date", weekEnd);

  const rows = (logs ?? []) as {
    log_date: string;
    entries: DailyLogEntry[] | null;
  }[];
  const withEntries = rows.filter((row) => (row.entries ?? []).length > 0);
  const thisWeek = rows.filter(
    (row) => row.log_date >= weekStart && row.log_date <= weekEnd,
  );
  const trackedMinutes = thisWeek.reduce(
    (sum, row) =>
      sum +
      (row.entries ?? []).reduce((total, entry) => total + entry.minutes, 0),
    0,
  );

  const asana = await loadCompletedAsanaTasks({
    userId,
    rangeStart: weekStart,
    rangeDays: 7,
  }).catch(() => ({ connected: false as const }));

  return {
    workdaysLogged: countWorkdaysLogged(
      withEntries.map((row) => row.log_date),
      weekStart,
    ),
    trackedMinutes,
    streakDays: computeStreak(
      withEntries.map((row) => row.log_date),
      today,
    ),
    goalProgress: averageGoalProgress(goals),
    asanaCompleted: asana.connected ? asana.tasks.length : null,
  };
}
