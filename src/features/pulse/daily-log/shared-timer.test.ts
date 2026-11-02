import { describe, expect, it } from "vitest";
import {
  elapsedSharedTimerMs,
  mergeTimerEntry,
  parseSharedTimer,
  pauseSharedTimer,
  resumeSharedTimer,
  sharedTimerEntry,
  type SharedActiveTimer,
} from "./shared-timer";

const now = new Date("2026-11-02T10:00:00.000Z");
const timer: SharedActiveTimer = {
  id: "11111111-1111-4111-8111-111111111111",
  logDate: "2026-11-02",
  task: "Client call",
  client: "Acme",
  category: "Meetings",
  startedAt: "2026-11-02T09:00:00.000Z",
  accumulatedMs: 10 * 60_000,
  running: true,
  source: "kazi",
  updatedAt: "2026-11-02T09:00:00.000Z",
};

describe("shared timer", () => {
  it("adds the running interval to earlier tracked time", () => {
    expect(elapsedSharedTimerMs(timer, now.getTime())).toBe(70 * 60_000);
  });

  it("freezes elapsed time while paused and resumes from the pause point", () => {
    const paused = pauseSharedTimer(timer, now);
    expect(paused.running).toBe(false);
    expect(paused.startedAt).toBeNull();
    expect(elapsedSharedTimerMs(paused, now.getTime() + 60 * 60_000)).toBe(
      70 * 60_000,
    );

    const resumed = resumeSharedTimer(
      paused,
      new Date("2026-11-02T11:00:00.000Z"),
    );
    expect(
      elapsedSharedTimerMs(
        resumed,
        new Date("2026-11-02T11:05:00.000Z").getTime(),
      ),
    ).toBe(75 * 60_000);
  });

  it("writes one entry with whole minutes and at least one minute", () => {
    expect(sharedTimerEntry(timer, now)).toEqual({
      task: "Client call",
      client: "Acme",
      category: "Meetings",
      minutes: 70,
    });
    expect(
      sharedTimerEntry(
        { ...timer, accumulatedMs: 0, startedAt: now.toISOString() },
        now,
      ).minutes,
    ).toBe(1);
  });

  it("writes only the time added since a resumed row's total", () => {
    const resumed = {
      ...timer,
      startedAt: now.toISOString(),
      accumulatedMs: 35 * 60_000,
      baseMs: 35 * 60_000,
    };
    const tenMinutesLater = new Date(now.getTime() + 10 * 60_000);
    expect(sharedTimerEntry(resumed, tenMinutesLater).minutes).toBe(10);
    expect(
      parseSharedTimer({ ...resumed, baseMs: 60 * 60_000 }, now).ok,
    ).toBe(false);
  });

  it("rejects payloads the server must not store", () => {
    expect(parseSharedTimer({ ...timer, id: "not-a-uuid" }, now).ok).toBe(
      false,
    );
    expect(parseSharedTimer({ ...timer, task: "" }, now).ok).toBe(false);
    expect(parseSharedTimer({ ...timer, category: "Gaming" }, now).ok).toBe(
      false,
    );
    expect(parseSharedTimer({ ...timer, logDate: "2020-01-01" }, now).ok).toBe(
      false,
    );
    expect(parseSharedTimer({ ...timer, accumulatedMs: -1 }, now).ok).toBe(
      false,
    );
  });

  it("normalizes an accepted payload", () => {
    const result = parseSharedTimer(
      {
        ...timer,
        running: false,
        startedAt: "2026-11-02T09:00:00.000Z",
        client: "  ",
      },
      now,
    );
    expect(result).toMatchObject({
      ok: true,
      timer: { running: false, startedAt: null, client: null },
    });
  });

  it("combines a session into the matching plain entry only", () => {
    const session = {
      task: "Client call",
      client: "Acme",
      category: "Meetings" as const,
      minutes: 20,
    };
    const result = mergeTimerEntry(
      [
        {
          task: "client call ",
          client: "Acme",
          category: "Meetings",
          minutes: 40,
        },
        {
          task: "Client call",
          client: "Acme",
          category: "Meetings",
          minutes: 15,
          startTime: "09:00",
          endTime: "09:15",
        },
      ],
      session,
    );
    expect(result.merged).toBe(true);
    expect(result.resulting.minutes).toBe(60);
    expect(result.entries).toHaveLength(2);
  });

  it("appends a new entry when no plain entry matches", () => {
    const result = mergeTimerEntry([], {
      task: "Review",
      client: null,
      category: "Other",
      minutes: 5,
    });
    expect(result.merged).toBe(false);
    expect(result.entries).toHaveLength(1);
  });
});
