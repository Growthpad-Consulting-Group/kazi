export type FollowThroughItem = {
  id: string;
  text: string;
  /** Short source label, e.g. "1-on-1 · 3 Nov" or the development plan title. */
  source: string;
  href: string;
  dueAt: Date | null;
  /** Where the commitment came from, so it can become an Asana task. */
  createFrom?: {
    sourceType: "one_on_one_action" | "development_action";
    sourceId: string;
    actionIndex: number;
  };
};

const MAX_ITEMS = 3;

/**
 * Orders open commitments: items with a due date first (soonest first), then
 * undated items in their original order. Returns at most `limit` items along
 * with the total number outstanding.
 */
export function rankFollowThrough(
  items: FollowThroughItem[],
  limit = MAX_ITEMS,
): { items: FollowThroughItem[]; total: number } {
  const dated = items
    .filter((item) => item.dueAt !== null)
    .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime());
  const undated = items.filter((item) => item.dueAt === null);
  const ranked = [...dated, ...undated];
  return { items: ranked.slice(0, limit), total: items.length };
}
