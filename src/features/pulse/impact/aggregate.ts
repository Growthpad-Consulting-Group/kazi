import {
  countWorkdaysLogged,
  shiftDate,
} from "@/features/pulse/dashboard/my-week";

export type WeekBucket = {
  weekStart: string;
  minutes: number;
  workdaysLogged: number;
};

/** Monday (YYYY-MM-DD) of the week containing `date`. */
export function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay();
  return shiftDate(date, day === 0 ? -6 : 1 - day);
}

/** The last `count` week-start Mondays, oldest first, ending with the week of `today`. */
export function recentWeekStarts(today: string, count: number): string[] {
  const current = mondayOf(today);
  return Array.from({ length: count }, (_, index) =>
    shiftDate(current, -7 * (count - 1 - index)),
  );
}

/** Weekly tracked minutes and logged workdays for each requested week. */
export function bucketWeeks(
  rows: { log_date: string; entries: { minutes: number }[] | null }[],
  weekStarts: string[],
): WeekBucket[] {
  return weekStarts.map((weekStart) => {
    const weekEnd = shiftDate(weekStart, 6);
    const inWeek = rows.filter(
      (row) => row.log_date >= weekStart && row.log_date <= weekEnd,
    );
    const minutes = inWeek.reduce(
      (sum, row) =>
        sum +
        (row.entries ?? []).reduce((total, entry) => total + entry.minutes, 0),
      0,
    );
    const logged = inWeek
      .filter((row) => (row.entries ?? []).length > 0)
      .map((row) => row.log_date);
    return {
      weekStart,
      minutes,
      workdaysLogged: countWorkdaysLogged(logged, weekStart),
    };
  });
}

/** Counts dates into the given months (keys formatted YYYY-MM), oldest first. */
export function countByMonth(
  dates: string[],
  months: string[],
): { month: string; count: number }[] {
  return months.map((month) => ({
    month,
    count: dates.filter((date) => date.startsWith(month)).length,
  }));
}

/** The last `count` month keys (YYYY-MM), oldest first, ending with the month of `today`. */
export function recentMonths(today: string, count: number): string[] {
  const [year, month] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(Date.UTC(year, month - 1 - (count - 1 - index), 1));
    return d.toISOString().slice(0, 7);
  });
}
