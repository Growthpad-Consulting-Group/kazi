import { shiftDate } from "./my-week";

export type TeamWeekTrend = {
  weekStart: string;
  /** Share of direct reports who submitted or had a check-in reviewed (0–100). */
  coverage: number;
  blockers: number;
  /** Average mood on a 1–5 scale, or null when nobody reported a mood. */
  averageMood: number | null;
};

export type TeamTrendRow = {
  week_start: string;
  status: "draft" | "submitted" | "reviewed";
  mood: number | null;
  blockers: string | null;
};

/**
 * Team-level weekly trend. Figures are aggregated across the whole team so the
 * strip describes the team's rhythm, never an individual's score.
 */
export function buildTeamTrend(
  rows: TeamTrendRow[],
  reportCount: number,
  weekStarts: string[],
): TeamWeekTrend[] {
  return weekStarts.map((weekStart) => {
    const inWeek = rows.filter((row) => row.week_start === weekStart);
    const submitted = inWeek.filter(
      (row) => row.status === "submitted" || row.status === "reviewed",
    ).length;
    const moods = inWeek.flatMap((row) =>
      row.mood === null ? [] : [row.mood],
    );
    return {
      weekStart,
      coverage: reportCount ? Math.round((submitted / reportCount) * 100) : 0,
      blockers: inWeek.filter((row) => Boolean(row.blockers?.trim())).length,
      averageMood: moods.length
        ? Math.round(
            (moods.reduce((sum, m) => sum + m, 0) / moods.length) * 10,
          ) / 10
        : null,
    };
  });
}

/** The last `count` week-start Mondays, oldest first, ending with the week of `weekStart`. */
export function trailingWeekStarts(weekStart: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    shiftDate(weekStart, -7 * (count - 1 - index)),
  );
}
