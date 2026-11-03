import { supabaseAdmin } from "@/lib/supabase";
import {
  buildTeamTrend,
  trailingWeekStarts,
  type TeamTrendRow,
  type TeamWeekTrend,
} from "./team-trend";

const TREND_WEEKS = 8;

/** Team-level weekly trend across direct reports only. */
export async function loadTeamTrend(
  reportIds: string[],
  weekStart: string,
): Promise<TeamWeekTrend[]> {
  const weekStarts = trailingWeekStarts(weekStart, TREND_WEEKS);
  if (!reportIds.length) return buildTeamTrend([], 0, weekStarts);

  const { data } = await supabaseAdmin
    .from("checkins")
    .select("week_start, status, mood, blockers")
    .in("user_id", reportIds)
    .gte("week_start", weekStarts[0])
    .lte("week_start", weekStart);

  return buildTeamTrend(
    (data ?? []) as TeamTrendRow[],
    reportIds.length,
    weekStarts,
  );
}
