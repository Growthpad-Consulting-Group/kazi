import { supabaseAdmin } from "@/lib/supabase";

export interface WalkOfFameEntry {
  id: string;
  name: string;
  department: string | null;
  count: number;
  tenureBadge: "10yr" | "5yr" | "3yr" | "1yr" | null;
  isRecent: boolean;
}

function computeTenureBadge(startDate: string | null): "10yr" | "5yr" | "3yr" | "1yr" | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  const now = new Date();
  const years = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (years >= 10) return "10yr";
  if (years >= 5) return "5yr";
  if (years >= 3) return "3yr";
  if (years >= 1) return "1yr";
  return null;
}

export async function getWalkOfFameData(): Promise<WalkOfFameEntry[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Run four queries in parallel
  const [
    { data: allCounts },
    { data: recentReceivers },
    { data: optedOut },
    { data: activeUsers },
  ] = await Promise.all([
    // (a) All-time recognition counts per recipient
    supabaseAdmin
      .from("feedback_recipients")
      .select("user_id"),
    // (b) Recipients with a recognition in the last 30 days
    supabaseAdmin
      .from("feedback_recipients")
      .select("user_id")
      .gte("created_at", thirtyDaysAgo.toISOString()),
    // (c) Opted-out users
    supabaseAdmin
      .from("engagement_notification_preferences")
      .select("user_id")
      .eq("show_on_leaderboard", false),
    // (d) Active user details
    supabaseAdmin
      .from("users")
      .select("id, name, department, start_date")
      .eq("is_active", true),
  ]);

  // Build lookup sets
  const optedOutSet = new Set((optedOut ?? []).map((r) => r.user_id));
  const recentSet = new Set((recentReceivers ?? []).map((r) => r.user_id));

  // Count all-time recognitions per user_id
  const countMap = new Map<string, number>();
  for (const row of allCounts ?? []) {
    countMap.set(row.user_id, (countMap.get(row.user_id) ?? 0) + 1);
  }

  // Build user detail map
  type UserRow = { id: string; name: string; department: string | null; start_date: string | null };
  const userMap = new Map<string, UserRow>();
  for (const user of (activeUsers ?? []) as UserRow[]) {
    userMap.set(user.id, user);
  }

  // Merge: filter opted-out, join details, attach badges
  const entries: WalkOfFameEntry[] = [];
  for (const [userId, count] of countMap.entries()) {
    if (optedOutSet.has(userId)) continue;
    const user = userMap.get(userId);
    if (!user) continue; // skip inactive/deleted users
    entries.push({
      id: userId,
      name: user.name,
      department: user.department,
      count,
      tenureBadge: computeTenureBadge(user.start_date),
      isRecent: recentSet.has(userId),
    });
  }

  // Sort by count desc, slice top 20
  entries.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return entries.slice(0, 20);
}
