import { describe, expect, it } from "vitest";
import {
  diffQueue,
  isSafePulsePath,
  median,
  summariseUsefulness,
  type QueueRow,
} from "./measurement";

describe("diffQueue", () => {
  it("reports items that opened and items that cleared", () => {
    expect(
      diffQueue(["daily_log", "survey"], ["daily_log", "side_quest"]),
    ).toEqual({
      opened: ["side_quest"],
      resolved: ["survey"],
    });
  });

  it("is empty when nothing changed", () => {
    expect(diffQueue(["daily_log"], ["daily_log"])).toEqual({
      opened: [],
      resolved: [],
    });
  });
});

describe("median", () => {
  it("handles odd, even and empty lists", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

function rows(
  kind: string,
  people: number,
  resolvedHours?: number,
): QueueRow[] {
  const shown = new Date("2026-11-01T09:00:00Z");
  return Array.from({ length: people }, (_, index) => ({
    user_id: `user-${index}`,
    kind,
    first_seen_at: shown.toISOString(),
    resolved_at:
      resolvedHours === undefined
        ? null
        : new Date(shown.getTime() + resolvedHours * 3_600_000).toISOString(),
  }));
}

describe("summariseUsefulness", () => {
  it("reports counts and median time to clear for groups large enough to share", () => {
    const [summary] = summariseUsefulness(
      [...rows("daily_log", 5, 2), ...rows("daily_log", 0)],
      [{ kind: "daily_log" }, { kind: "daily_log" }],
    );
    expect(summary).toEqual({
      kind: "daily_log",
      people: 5,
      resolved: 5,
      medianHoursToResolve: 2,
      clicks: 2,
      suppressed: false,
    });
  });

  it("suppresses groups below the minimum so no one can be traced", () => {
    const [summary] = summariseUsefulness(rows("side_quest", 4, 3), [
      { kind: "side_quest" },
    ]);
    expect(summary.suppressed).toBe(true);
    expect(summary.people).toBe(4);
    expect(summary.clicks).toBe(0);
    expect(summary.resolved).toBe(0);
    expect(summary.medianHoursToResolve).toBeNull();
  });
});

describe("isSafePulsePath", () => {
  it("accepts only same-app Pulse paths", () => {
    expect(isSafePulsePath("/pulse/checkins?tab=daily")).toBe(true);
    expect(isSafePulsePath("https://evil.example/pulse")).toBe(false);
    expect(isSafePulsePath("//evil.example/pulse")).toBe(false);
    expect(isSafePulsePath("/settings")).toBe(false);
    expect(isSafePulsePath("/pulse\\..\\evil")).toBe(false);
  });
});
