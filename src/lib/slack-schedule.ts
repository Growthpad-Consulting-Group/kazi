// Pure time helpers for Slack delivery. No database or network access here, so
// they can be unit-tested with fixed instants.

export type LocalClock = {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** 0 = Sunday … 6 = Saturday, matching Date#getDay. */
  weekday: number;
  /** Minutes since local midnight. */
  minutes: number;
};

const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** The wall-clock date, weekday and time of `now` in an IANA timezone. */
export function localClock(now: Date, timeZone: string): LocalClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    weekday: WEEKDAYS[value("weekday")] ?? 0,
    minutes: Number(value("hour")) * 60 + Number(value("minute")),
  };
}

/** Converts "HH:MM" or "HH:MM:SS" to minutes since midnight. */
export function clockToMinutes(
  value: string | null | undefined,
  fallback: string,
) {
  const source = value && value.includes(":") ? value : fallback;
  const [hour, minute] = source.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

/** "HH:MM" for an instant, in the given timezone. */
export function clockLabel(now: Date, timeZone: string): string {
  const { minutes } = localClock(now, timeZone);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** True when the local time falls in [start, start + windowMinutes). */
export function inWindow(
  clock: LocalClock,
  startMinutes: number,
  windowMinutes: number,
): boolean {
  return (
    clock.minutes >= startMinutes &&
    clock.minutes < startMinutes + windowMinutes
  );
}

/**
 * Like `inWindow`, but permits a bounded catch-up period after a scheduled
 * start. Workers use this after quiet hours: the event key still prevents a
 * second delivery, while a staff member does not lose a useful digest merely
 * because their quiet period ended just after its normal window.
 */
export function inCatchUpWindow(
  clock: LocalClock,
  startMinutes: number,
  windowMinutes: number,
  maxDelayMinutes: number,
): boolean {
  return (
    clock.minutes >= startMinutes &&
    clock.minutes < startMinutes + windowMinutes + maxDelayMinutes
  );
}

/**
 * True when `now` is inside a quiet-hours range that may cross midnight.
 * Equal start and end means quiet hours are off.
 */
export function isInQuietHours(
  start: string | null,
  end: string | null,
  timeZone: string | null,
  now: Date,
): boolean {
  if (!start || !end) return false;
  const quietStart = clockToMinutes(start, "00:00");
  const quietEnd = clockToMinutes(end, "00:00");
  if (quietStart === quietEnd) return false;
  const { minutes } = localClock(now, timeZone || "Africa/Nairobi");
  return quietStart < quietEnd
    ? minutes >= quietStart && minutes < quietEnd
    : minutes >= quietStart || minutes < quietEnd;
}

/** Monday (YYYY-MM-DD) of the week containing the local date. */
export function weekStartOf(localDate: string, weekday: number): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const offset = weekday === 0 ? -6 : 1 - weekday;
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return date.toISOString().slice(0, 10);
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}
