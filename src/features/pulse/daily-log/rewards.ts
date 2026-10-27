import { supabaseAdmin } from "@/lib/supabase";
import { runAutomationEvent } from "@/lib/automations";
import type { DailyLogEntry } from "./constants";

/** A day only counts for rewards once it has this much logged time, so token entries don't earn points. */
export const REWARD_MIN_MINUTES = 15;
const STREAK_STEP = 5;
const STREAK_LOOKBACK_DAYS = 90;

const DAY_MS = 86_400_000;

export function qualifiesForReward(entries: DailyLogEntry[]): boolean {
  return entries.reduce((sum, entry) => sum + entry.minutes, 0) >= REWARD_MIN_MINUTES;
}

function shiftDate(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Runs the daily log automations after a save. Each rule runs at most once per person per event key,
 * so a day is only rewarded once even if it is edited.
 */
export async function awardDailyLogRewards(userId: string, date: string, entries: DailyLogEntry[]): Promise<void> {
  if (!qualifiesForReward(entries)) return;

  await runAutomationEvent({
    trigger: "daily_log_logged",
    eventKey: `daily_log:${date}`,
    recipientIds: [userId],
    notification: async () => {},
    pointReason: "Logged daily activity",
    referenceId: `daily_log:${date}`,
  });

  // Count the run of qualifying days that ends on this date, and reward every full run of five.
  const { data } = await (supabaseAdmin as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- daily_activity_logs is typed without the newest columns
    .from("daily_activity_logs")
    .select("log_date, entries")
    .eq("user_id", userId)
    .gte("log_date", shiftDate(date, -STREAK_LOOKBACK_DAYS))
    .lte("log_date", date);
  const qualifyingDays = new Set(
    ((data ?? []) as { log_date: string; entries: DailyLogEntry[] }[])
      .filter((row) => qualifiesForReward(row.entries ?? []))
      .map((row) => row.log_date)
  );

  let streak = 0;
  for (let offset = 0; qualifyingDays.has(shiftDate(date, -offset)); offset += 1) streak += 1;
  if (streak >= STREAK_STEP && streak % STREAK_STEP === 0) {
    const paid = await runAutomationEvent({
      trigger: "daily_log_streak",
      eventKey: `daily_log_streak:${date}`,
      recipientIds: [userId],
      notification: async () => {},
      pointReason: `Logged ${streak} days in a row`,
      referenceId: `daily_log_streak:${date}`,
    });
    // Only tell them when the reward was actually given, so a retry never repeats the message.
    if (paid > 0) {
      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        message: `You've logged your day ${streak} days in a row. Well done.`,
        link: "/pulse/checkins?tab=daily",
      });
    }
  }
}
