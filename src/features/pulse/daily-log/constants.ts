export const DAILY_LOG_CATEGORIES = ["Meetings", "Hiring", "Reporting", "Projects", "Admin", "Other"] as const;
export type DailyLogCategory = (typeof DAILY_LOG_CATEGORIES)[number];

export type DailyLogEntry = { task: string; minutes: number; category: DailyLogCategory; startTime?: string | null; endTime?: string | null };

const CLOCK_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function clockToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

const MAX_ENTRIES = 30;
const MAX_TASK_LENGTH = 200;
const MAX_MINUTES_PER_DAY = 24 * 60;

export function validateDailyLogEntries(input: unknown): { ok: true; entries: DailyLogEntry[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "entries must be a list" };
  if (input.length > MAX_ENTRIES) return { ok: false, error: `Log at most ${MAX_ENTRIES} tasks a day` };

  const entries: DailyLogEntry[] = [];
  for (const raw of input as Record<string, unknown>[]) {
    const task = typeof raw?.task === "string" ? raw.task.trim() : "";
    const category = raw?.category as DailyLogCategory;
    const startTime = typeof raw?.startTime === "string" && raw.startTime ? raw.startTime : null;
    const endTime = typeof raw?.endTime === "string" && raw.endTime ? raw.endTime : null;
    if (!task || task.length > MAX_TASK_LENGTH) return { ok: false, error: `Each task needs a description up to ${MAX_TASK_LENGTH} characters` };
    if (!DAILY_LOG_CATEGORIES.includes(category)) return { ok: false, error: "Choose a valid category for each task" };

    let minutes = Number(raw?.minutes);
    if (startTime || endTime) {
      if (!startTime || !endTime || !CLOCK_PATTERN.test(startTime) || !CLOCK_PATTERN.test(endTime)) {
        return { ok: false, error: "Start and end times must both be set as HH:MM" };
      }
      minutes = clockToMinutes(endTime) - clockToMinutes(startTime);
      if (minutes <= 0) return { ok: false, error: `"${task}" must end after it starts` };
    }
    if (!Number.isInteger(minutes) || minutes <= 0) return { ok: false, error: "Minutes must be a whole number above zero" };

    entries.push({ task, minutes, category, startTime, endTime });
  }

  const total = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  if (total > MAX_MINUTES_PER_DAY) return { ok: false, error: "A day can't exceed 24 hours" };
  return { ok: true, entries };
}

/** Accepts "90", "45m", "1h", "1h 30m", "1.5h", "1:30". Returns whole minutes or null when unreadable. */
export function parseDurationMinutes(input: string): number | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;

  const clock = text.match(/^(\d{1,2}):(\d{2})$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

  const hoursMinutes = text.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m)?$/);
  if (hoursMinutes && (hoursMinutes[1] || hoursMinutes[2])) {
    const hours = hoursMinutes[1] ? Number(hoursMinutes[1]) : 0;
    const minutes = hoursMinutes[2] ? Number(hoursMinutes[2]) : 0;
    const total = Math.round(hours * 60 + minutes);
    return total > 0 ? total : null;
  }

  const plain = Number(text);
  return Number.isInteger(plain) && plain > 0 ? plain : null;
}

export function isValidLogDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}
