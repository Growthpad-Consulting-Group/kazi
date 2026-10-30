import { supabaseAdmin } from "@/lib/supabase";

function weekStart(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function hasFourWeekStreak(periods: string[]) {
  const starts = [...new Set(periods.map(weekStart))].sort().reverse();
  if (starts.length < 4) return false;
  const expected = new Date(`${starts[0]}T00:00:00Z`);
  for (const period of starts.slice(0, 4)) {
    if (period !== expected.toISOString().slice(0, 10)) return false;
    expected.setUTCDate(expected.getUTCDate() - 7);
  }
  return true;
}

export async function refreshSideQuestAchievements(
  userId: string,
  questId: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed achievements table awaits generated types
  const db = supabaseAdmin as any;
  const [{ data: quest }, { data: completions }] = await Promise.all([
    supabaseAdmin
      .from("side_quests")
      .select("title, repeat_frequency")
      .eq("id", questId)
      .maybeSingle(),
    supabaseAdmin
      .from("side_quest_completions")
      .select("period_key")
      .eq("side_quest_id", questId)
      .eq("user_id", userId)
      .eq("status", "approved"),
  ]);
  if (!quest) return;
  const periods = (completions ?? []).map((item) => item.period_key);
  const awards: {
    user_id: string;
    code: string;
    title: string;
    description: string;
    icon: string;
    metadata: Record<string, string>;
  }[] = [];

  if (quest.repeat_frequency === "weekly" && hasFourWeekStreak(periods)) {
    awards.push({
      user_id: userId,
      code: `weekly-quest-streak:${questId}`,
      title: "Four-week streak",
      description: `Completed ${quest.title} in four consecutive weeks.`,
      icon: "solar:fire-broken",
      metadata: { questId },
    });
  }
  if (/masterclass|knowledge/i.test(quest.title) && periods.length >= 3) {
    awards.push({
      user_id: userId,
      code: "knowledge-sharer",
      title: "Knowledge Sharer",
      description: "Completed three knowledge-sharing Side Quests.",
      icon: "solar:medal-ribbon-broken",
      metadata: { questId },
    });
  }
  if (awards.length) {
    await db.from("staff_achievements").upsert(awards, {
      onConflict: "user_id,code",
      ignoreDuplicates: true,
    });
  }
}
