import { supabaseAdmin } from "@/lib/supabase";
import { sanitiseHomeModules, type HomeModuleId } from "./home-modules";

export type HomeModuleCard = {
  id: HomeModuleId;
  label: string;
  value: string;
  hint: string;
  href: string;
};

const DAY = 86_400_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table
const db = supabaseAdmin as any;

export async function loadHomeModuleSelection(
  userId: string,
): Promise<HomeModuleId[]> {
  // Fail soft: if the table is unavailable, the page still renders with the fixed queue.
  try {
    const { data, error } = await db
      .from("pulse_home_modules")
      .select("modules")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return [];
    return sanitiseHomeModules(data?.modules ?? []);
  } catch {
    return [];
  }
}

/** Cards for the chosen modules only. Every figure is the signed-in user's own. */
export async function loadHomeModuleCards(
  userId: string,
  modules: HomeModuleId[],
  now: Date,
): Promise<HomeModuleCard[]> {
  if (!modules.length) return [];
  const today = now.toISOString().slice(0, 10);
  const in7 = new Date(now.getTime() + 7 * DAY).toISOString().slice(0, 10);
  const in14 = new Date(now.getTime() + 14 * DAY).toISOString();

  const cards: HomeModuleCard[] = [];
  for (const id of modules) {
    if (id === "rewards") {
      const { data } = await db
        .from("reward_wallets")
        .select("balance")
        .eq("user_id", userId)
        .maybeSingle();
      const balance = data?.balance ?? 0;
      cards.push({
        id,
        label: "Rewards",
        value: `${balance} pts`,
        hint: "Available to redeem",
        href: "/pulse/rewards",
      });
    }
    if (id === "recognition") {
      const { count } = await db
        .from("feedback")
        .select("id", { count: "exact", head: true })
        .eq("to_user_id", userId)
        .eq("visibility", "public")
        .gte("created_at", new Date(now.getTime() - 30 * DAY).toISOString());
      cards.push({
        id,
        label: "Recognition",
        value: String(count ?? 0),
        hint: "Last 30 days",
        href: "/pulse/feedback",
      });
    }
    if (id === "goals") {
      const { data } = await db
        .from("goals")
        .select("due_date")
        .eq("owner_id", userId)
        .not("status", "in", "(completed,cancelled)");
      const open = (data ?? []) as { due_date: string | null }[];
      const dueThisWeek = open.filter(
        (goal) =>
          goal.due_date && goal.due_date >= today && goal.due_date <= in7,
      ).length;
      cards.push({
        id,
        label: "Goals",
        value: String(open.length),
        hint: dueThisWeek ? `${dueThisWeek} due this week` : "Open goals",
        href: "/pulse/goals",
      });
    }
    if (id === "upcoming") {
      const { data } = await db
        .from("one_on_ones")
        .select("scheduled_at")
        .or(`manager_id.eq.${userId},report_id.eq.${userId}`)
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", in14)
        .order("scheduled_at", { ascending: true });
      const meetings = (data ?? []) as { scheduled_at: string }[];
      cards.push({
        id,
        label: "Upcoming 1-on-1s",
        value: String(meetings.length),
        hint: meetings[0]
          ? `Next ${new Date(meetings[0].scheduled_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}`
          : "Next two weeks",
        href: "/pulse/one-on-ones",
      });
    }
  }
  return cards;
}
