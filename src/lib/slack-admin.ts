// Pure helpers for Slack administration. They work on delivery metadata only:
// categories, statuses and short reasons. Message content is never stored or read here.

export const KNOWN_CATEGORIES = [
  "checkin_submitted",
  "checkin_reminder",
  "one_on_one_scheduled",
  "one_on_one_reminder",
  "survey_published",
  "campaign_update",
  "side_quest_update",
  "goal_completed",
  "goal_due_soon",
  "review_open",
  "daily_brief",
  "overtime_request",
  "mention",
  "voice_out",
  "interview",
  "culture_recap",
  "culture_wall_of_fame",
  "culture_side_quest",
  "hall_of_fame_nominations",
  "admin_test",
] as const;

/** Sends allowed across the whole workspace in any rolling minute. */
export const RATE_LIMIT_PER_MINUTE = 120;
/** Test messages an administrator may send in any rolling hour. */
export const TEST_SEND_LIMIT_PER_HOUR = 5;

export type DeliveryRow = {
  category: string;
  status: "pending" | "delivered" | "suppressed" | "failed";
  error: string | null;
};

export type CategorySummary = {
  category: string;
  delivered: number;
  suppressed: number;
  failed: number;
  reasons: { reason: string; count: number }[];
};

/** Counts by category and status, with the most common reasons for suppression or failure. */
export function summariseDeliveries(rows: DeliveryRow[]): CategorySummary[] {
  const byCategory = new Map<string, DeliveryRow[]>();
  for (const row of rows) {
    byCategory.set(row.category, [
      ...(byCategory.get(row.category) ?? []),
      row,
    ]);
  }
  return [...byCategory.entries()]
    .map(([category, items]) => {
      const reasonCounts = new Map<string, number>();
      for (const item of items) {
        if (item.status !== "suppressed" && item.status !== "failed") continue;
        const reason = (item.error ?? "No reason recorded").slice(0, 120);
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
      }
      return {
        category,
        delivered: items.filter((item) => item.status === "delivered").length,
        suppressed: items.filter((item) => item.status === "suppressed").length,
        failed: items.filter((item) => item.status === "failed").length,
        reasons: [...reasonCounts.entries()]
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category));
}

export function isOverLimit(count: number, limit: number): boolean {
  return count >= limit;
}
