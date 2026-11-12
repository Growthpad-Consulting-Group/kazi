// Pure helpers for Pulse usefulness measurement and safe item links. No I/O here.

export type QueueScope = "employee" | "attention";

/** Items that became visible or stopped being visible since the last render. */
export function diffQueue(
  openKinds: string[],
  currentKinds: string[],
): { opened: string[]; resolved: string[] } {
  const open = new Set(openKinds);
  const current = new Set(currentKinds);
  return {
    opened: [...current].filter((kind) => !open.has(kind)),
    resolved: [...open].filter((kind) => !current.has(kind)),
  };
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export type QueueRow = {
  user_id: string;
  kind: string;
  first_seen_at: string;
  resolved_at: string | null;
};

export type UsefulnessRow = {
  kind: string;
  /** Distinct people who saw this item. */
  people: number;
  /** Items that were completed or cleared. */
  resolved: number;
  /** Median hours from first shown to cleared, or null when nothing has cleared. */
  medianHoursToResolve: number | null;
  clicks: number;
  /** Set when there are too few people to report without identifying anyone. */
  suppressed: boolean;
};

/**
 * Aggregates queue history and link clicks per item kind. Any kind seen by
 * fewer than `minGroup` people is marked suppressed and reports no counts, so
 * a small group cannot be traced back to one person.
 */
export function summariseUsefulness(
  queueRows: QueueRow[],
  clicks: { kind: string }[],
  minGroup = 5,
): UsefulnessRow[] {
  const kinds = new Set([
    ...queueRows.map((row) => row.kind),
    ...clicks.map((click) => click.kind),
  ]);
  return [...kinds].sort().map((kind) => {
    const rows = queueRows.filter((row) => row.kind === kind);
    const people = new Set(rows.map((row) => row.user_id)).size;
    const suppressed = people < minGroup;
    const resolvedRows = rows.filter((row) => row.resolved_at);
    const durations = resolvedRows.map(
      (row) =>
        (new Date(row.resolved_at!).getTime() -
          new Date(row.first_seen_at).getTime()) /
        3_600_000,
    );
    const clickCount = clicks.filter((click) => click.kind === kind).length;
    if (suppressed)
      return {
        kind,
        people,
        resolved: 0,
        medianHoursToResolve: null,
        clicks: 0,
        suppressed: true,
      };
    return {
      kind,
      people,
      resolved: resolvedRows.length,
      medianHoursToResolve: median(durations),
      clicks: clickCount,
      suppressed: false,
    };
  });
}

/** Kinds that the item links are allowed to name. Anything else is rejected. */
export const KNOWN_KINDS: Record<QueueScope, readonly string[]> = {
  employee: [
    "review_acknowledgement",
    "daily_log",
    "weekly_checkin",
    "survey",
    "side_quest",
    "wall_of_fame",
    "one_on_one_prep",
    "action_items",
  ],
  attention: [
    "flagged_team_member",
    "voice_out_case",
    "overtime_request",
    "checkin_review",
    "review_to_complete",
    "reward_redemption",
    "side_quest_approval",
    "overdue_scorecard",
  ],
};

/** Only same-app paths under /pulse, so the redirect cannot send people elsewhere. */
export function isSafePulsePath(to: string): boolean {
  return (
    to.startsWith("/pulse") &&
    !to.startsWith("//") &&
    !to.includes("\\") &&
    !/[\r\n]/.test(to)
  );
}

export function goHref(scope: QueueScope, kind: string, to: string): string {
  return `/api/pulse/go?scope=${scope}&kind=${encodeURIComponent(kind)}&to=${encodeURIComponent(to)}`;
}
