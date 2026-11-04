import { supabaseAdmin } from "@/lib/supabase";
import {
  buildTeamTrend,
  trailingWeekStarts,
  type TeamTrendRow,
  type TeamWeekSignals,
  type TeamWeekTrend,
} from "./team-trend";

const TREND_WEEKS = 8;

/** Team-level weekly trend across direct reports only. */
export async function loadTeamTrend(
  reportIds: string[],
  managerId: string,
  weekStart: string,
): Promise<TeamWeekTrend[]> {
  const weekStarts = trailingWeekStarts(weekStart, TREND_WEEKS);
  if (!reportIds.length) return buildTeamTrend([], 0, weekStarts);

  const [checkins, recognitions, conversations] = await Promise.all([
    supabaseAdmin
      .from("checkins")
      .select("week_start, status, mood, blockers")
      .in("user_id", reportIds)
      .gte("week_start", weekStarts[0])
      .lte("week_start", weekStart),
    supabaseAdmin
      .from("feedback_recipients")
      .select("created_at")
      .in("user_id", reportIds)
      .gte("created_at", `${weekStarts[0]}T00:00:00.000Z`),
    supabaseAdmin
      .from("one_on_ones")
      .select("scheduled_at, action_items")
      .eq("manager_id", managerId)
      .gte("scheduled_at", `${weekStarts[0]}T00:00:00.000Z`)
      .not("scheduled_at", "is", null),
  ]);

  const signalByWeek = new Map<string, TeamWeekSignals>();
  for (const week of weekStarts)
    signalByWeek.set(week, {
      week_start: week,
      recognitions: 0,
      openActions: 0,
    });
  for (const recognition of recognitions.data ?? []) {
    const week = mondayUtc(recognition.created_at);
    const signal = signalByWeek.get(week);
    if (signal) signal.recognitions += 1;
  }
  for (const conversation of conversations.data ?? []) {
    if (!conversation.scheduled_at) continue;
    const signal = signalByWeek.get(mondayUtc(conversation.scheduled_at));
    if (!signal) continue;
    const actions = Array.isArray(conversation.action_items)
      ? (conversation.action_items as { done?: boolean }[])
      : [];
    signal.openActions += actions.filter((action) => !action.done).length;
  }

  return buildTeamTrend(
    (checkins.data ?? []) as TeamTrendRow[],
    reportIds.length,
    weekStarts,
    [...signalByWeek.values()],
  );
}

function mondayUtc(value: string) {
  const date = new Date(value);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  return date.toISOString().slice(0, 10);
}
