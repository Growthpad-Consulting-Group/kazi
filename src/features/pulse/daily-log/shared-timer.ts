import type { DailyLogCategory } from "./constants";

export type SharedActiveTimer = {
  id: string;
  logDate: string;
  task: string;
  client: string | null;
  category: DailyLogCategory;
  startedAt: string | null;
  accumulatedMs: number;
  running: boolean;
  source: "kazi" | "extension";
  updatedAt: string;
};

export function elapsedSharedTimerMs(
  timer: SharedActiveTimer,
  now = Date.now(),
) {
  if (!timer.running || !timer.startedAt) return timer.accumulatedMs;
  return Math.max(
    0,
    timer.accumulatedMs + now - new Date(timer.startedAt).getTime(),
  );
}
