import {
  DAILY_LOG_CATEGORIES,
  isEditableLogDate,
  isValidLogDate,
  type DailyLogCategory,
  type DailyLogEntry,
} from "./constants";

/**
 * The one active-timer payload shared by Kazi and the browser extension.
 * The server is the authority: clients send intent (start, pause, resume,
 * stop) and render what the server returns.
 */
export type SharedActiveTimer = {
  /** Client-generated UUID. Doubles as the idempotency key for stop. */
  id: string;
  logDate: string;
  task: string;
  client: string | null;
  category: DailyLogCategory;
  /** ISO timestamp of the current running interval, or null while paused. */
  startedAt: string | null;
  /** Milliseconds already tracked in earlier running intervals. */
  accumulatedMs: number;
  running: boolean;
  source: "kazi" | "extension";
  updatedAt: string;
};

const MAX_TIMER_MS = 24 * 60 * 60 * 1000;
const MAX_TASK_LENGTH = 200;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function elapsedSharedTimerMs(
  timer: SharedActiveTimer,
  now = Date.now(),
) {
  if (!timer.running || !timer.startedAt) return timer.accumulatedMs;
  const runningMs = now - new Date(timer.startedAt).getTime();
  return Math.min(MAX_TIMER_MS, Math.max(0, timer.accumulatedMs + runningMs));
}

export function pauseSharedTimer(
  timer: SharedActiveTimer,
  now = new Date(),
): SharedActiveTimer {
  return {
    ...timer,
    accumulatedMs: elapsedSharedTimerMs(timer, now.getTime()),
    startedAt: null,
    running: false,
    updatedAt: now.toISOString(),
  };
}

export function resumeSharedTimer(
  timer: SharedActiveTimer,
  now = new Date(),
): SharedActiveTimer {
  if (timer.running) return timer;
  return {
    ...timer,
    startedAt: now.toISOString(),
    running: true,
    updatedAt: now.toISOString(),
  };
}

/** The single daily-log entry a stopped timer produces. Minutes round down, minimum one. */
export function sharedTimerEntry(
  timer: SharedActiveTimer,
  now = new Date(),
): DailyLogEntry {
  const minutes = Math.max(
    1,
    Math.floor(elapsedSharedTimerMs(timer, now.getTime()) / 60_000),
  );
  return {
    task: timer.task,
    client: timer.client || null,
    category: timer.category,
    minutes,
  };
}

export function parseSharedTimer(
  input: unknown,
  now = new Date(),
): { ok: true; timer: SharedActiveTimer } | { ok: false; error: string } {
  if (!input || typeof input !== "object")
    return { ok: false, error: "A timer is required" };
  const value = input as Record<string, unknown>;
  if (typeof value.id !== "string" || !UUID_PATTERN.test(value.id))
    return { ok: false, error: "Timer id must be a UUID" };
  if (!isValidLogDate(value.logDate))
    return { ok: false, error: "A valid log date is required" };
  if (!isEditableLogDate(value.logDate, now))
    return {
      ok: false,
      error: "This day is locked. Timers can be logged for the last 7 days.",
    };
  const task = typeof value.task === "string" ? value.task.trim() : "";
  if (!task || task.length > MAX_TASK_LENGTH)
    return { ok: false, error: "Name the activity before starting a timer" };
  if (
    value.client !== null &&
    value.client !== undefined &&
    typeof value.client !== "string"
  )
    return { ok: false, error: "Client must be text" };
  const category = value.category as DailyLogCategory;
  if (!DAILY_LOG_CATEGORIES.includes(category))
    return { ok: false, error: "Choose a valid category" };
  if (value.source !== "kazi" && value.source !== "extension")
    return { ok: false, error: "Timer source is invalid" };
  const accumulatedMs = value.accumulatedMs;
  if (
    typeof accumulatedMs !== "number" ||
    !Number.isFinite(accumulatedMs) ||
    accumulatedMs < 0 ||
    accumulatedMs > MAX_TIMER_MS
  )
    return { ok: false, error: "Timer duration is invalid" };
  const running = value.running === true;
  const startedAt =
    typeof value.startedAt === "string" &&
    !Number.isNaN(new Date(value.startedAt).getTime())
      ? value.startedAt
      : null;
  if (running && !startedAt)
    return { ok: false, error: "A running timer needs a start time" };

  return {
    ok: true,
    timer: {
      id: value.id,
      logDate: value.logDate,
      task,
      client:
        typeof value.client === "string" ? value.client.trim() || null : null,
      category,
      startedAt: running ? startedAt : null,
      accumulatedMs: Math.round(accumulatedMs),
      running,
      source: value.source,
      updatedAt: now.toISOString(),
    },
  };
}
