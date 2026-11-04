export type MyWeekSummary = {
  /** Workdays (Mon–Fri) with at least one logged entry this week. */
  workdaysLogged: number;
  /** Total minutes logged this week across all days. */
  trackedMinutes: number;
  /** Consecutive logged days ending today (or yesterday, if today is not logged yet). */
  streakDays: number;
  /** Average progress across active goals, or null when there are none. */
  goalProgress: number | null;
  /** Completed Asana tasks this week, or null when Asana is not connected. */
  asanaCompleted: number | null;
  /** Minimal staff-owned Asana task health, or null when Asana is not connected. */
  asanaTaskHealth: {
    dueToday: {
      id: string;
      name: string;
      dueOn: string | null;
      project: string | null;
      url: string | null;
    }[];
    overdue: {
      id: string;
      name: string;
      dueOn: string | null;
      project: string | null;
      url: string | null;
    }[];
    blocked: {
      id: string;
      name: string;
      dueOn: string | null;
      project: string | null;
      url: string | null;
    }[];
    completedRecently: {
      id: string;
      name: string;
      completedAt: string;
      project: string | null;
      url: string | null;
    }[];
  } | null;
};

export const WORKDAYS_PER_WEEK = 5;

/** Daily logs are recorded against the company's working timezone. */
export function todayInWorkTimezone(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Counts Mon–Fri days in the week starting `weekStart` (a Monday, YYYY-MM-DD)
 * that have at least one logged entry. Weekend logs are not counted towards
 * the workday total.
 */
export function countWorkdaysLogged(
  loggedDates: Iterable<string>,
  weekStart: string,
): number {
  const logged = new Set(loggedDates);
  let count = 0;
  for (let offset = 0; offset < WORKDAYS_PER_WEEK; offset++) {
    if (logged.has(shiftDate(weekStart, offset))) count++;
  }
  return count;
}

/**
 * Consecutive logged days ending today. If today has no entry yet, the streak
 * is counted from yesterday so the number does not reset before the day ends.
 */
export function computeStreak(
  loggedDates: Iterable<string>,
  today: string,
): number {
  const logged = new Set(loggedDates);
  let cursor = logged.has(today) ? today : shiftDate(today, -1);
  let streak = 0;
  while (logged.has(cursor)) {
    streak++;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

export function averageGoalProgress(
  goals: { progress: number }[],
): number | null {
  if (!goals.length) return null;
  const total = goals.reduce((sum, goal) => sum + goal.progress, 0);
  return Math.round(total / goals.length);
}
