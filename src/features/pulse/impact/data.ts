import { supabaseAdmin } from "@/lib/supabase";
import {
  bucketWeeks,
  countByMonth,
  recentMonths,
  recentWeekStarts,
  type WeekBucket,
} from "./aggregate";

const WEEKS = 8;
const MONTHS = 6;

export type ImpactData = {
  weeks: WeekBucket[];
  goals: { title: string; status: string; progress: number }[];
  recognitionByMonth: { month: string; count: number }[];
  recognitionTotal: number;
  quests: { title: string; completedAt: string }[];
  achievements: {
    id: string;
    title: string;
    description: string;
    icon: string;
    awardedAt: string;
  }[];
  milestones: { type: string; date: string; yearsCount: number | null }[];
};

/**
 * Own-data only: every query is scoped to the signed-in user, and no peer
 * comparison is produced. Manager-only notes are never read here.
 */
export async function loadMyImpact(
  userId: string,
  today: string,
): Promise<ImpactData> {
  const weekStarts = recentWeekStarts(today, WEEKS);
  const months = recentMonths(today, MONTHS);
  const since = `${months[0]}-01T00:00:00Z`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables lag generated types
  const db = supabaseAdmin as any;
  const [logs, goals, feedback, completions, achievements, milestones] =
    await Promise.all([
      db
        .from("daily_activity_logs")
        .select("log_date, entries")
        .eq("user_id", userId)
        .gte("log_date", weekStarts[0])
        .lte("log_date", today),
      supabaseAdmin
        .from("goals")
        .select("title, status, progress")
        .eq("owner_id", userId),
      supabaseAdmin
        .from("feedback")
        .select("created_at")
        .eq("to_user_id", userId)
        .eq("visibility", "public")
        .gte("created_at", since),
      db
        .from("side_quest_completions")
        .select("completed_at, side_quests(title)")
        .eq("user_id", userId)
        .eq("status", "approved")
        .order("completed_at", { ascending: false })
        .limit(10),
      db
        .from("staff_achievements")
        .select("id, title, description, icon, awarded_at")
        .eq("user_id", userId)
        .order("awarded_at", { ascending: false })
        .limit(12),
      db
        .from("milestones")
        .select("type, milestone_date, years_count")
        .eq("user_id", userId)
        .order("milestone_date", { ascending: false })
        .limit(10),
    ]);

  const feedbackDates = ((feedback.data ?? []) as { created_at: string }[]).map(
    (row) => row.created_at.slice(0, 7),
  );

  return {
    weeks: bucketWeeks(
      (logs.data ?? []) as {
        log_date: string;
        entries: { minutes: number }[] | null;
      }[],
      weekStarts,
    ),
    goals: (goals.data ?? []) as ImpactData["goals"],
    recognitionByMonth: countByMonth(feedbackDates, months),
    recognitionTotal: feedbackDates.length,
    quests: (
      (completions.data ?? []) as {
        completed_at: string;
        side_quests: { title: string } | null;
      }[]
    ).map((row) => ({
      title: row.side_quests?.title ?? "Side Quest",
      completedAt: row.completed_at,
    })),
    achievements: (
      (achievements.data ?? []) as {
        id: string;
        title: string;
        description: string;
        icon: string;
        awarded_at: string;
      }[]
    ).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      icon: row.icon,
      awardedAt: row.awarded_at,
    })),
    milestones: (
      (milestones.data ?? []) as {
        type: string;
        milestone_date: string;
        years_count: number | null;
      }[]
    ).map((row) => ({
      type: row.type,
      date: row.milestone_date,
      yearsCount: row.years_count,
    })),
  };
}
