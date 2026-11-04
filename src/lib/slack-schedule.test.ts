import { describe, expect, it } from "vitest";
import {
  addDays,
  clockToMinutes,
  inCatchUpWindow,
  inWindow,
  isInQuietHours,
  localClock,
  weekStartOf,
} from "./slack-schedule";

// 2026-11-06 is a Friday. 07:30 UTC is 10:30 in Nairobi (UTC+3).
const friday0730Utc = new Date("2026-11-06T07:30:00Z");

describe("localClock", () => {
  it("returns the local date, weekday and minutes for a timezone", () => {
    expect(localClock(friday0730Utc, "Africa/Nairobi")).toEqual({
      date: "2026-11-06",
      weekday: 5,
      minutes: 10 * 60 + 30,
    });
  });

  it("can roll the date back across midnight", () => {
    // 23:30 UTC on Thursday is 02:30 on Friday in Nairobi (UTC+3).
    const clock = localClock(
      new Date("2026-11-05T23:30:00Z"),
      "Africa/Nairobi",
    );
    expect(clock.date).toBe("2026-11-06");
    expect(clock.minutes).toBe(2 * 60 + 30);
  });
});

describe("clockToMinutes", () => {
  it("parses HH:MM and HH:MM:SS, using the fallback when missing", () => {
    expect(clockToMinutes("08:30:00", "08:00")).toBe(510);
    expect(clockToMinutes(null, "08:00")).toBe(480);
  });
});

describe("inWindow", () => {
  it("includes the start and excludes the end", () => {
    const at = (minutes: number) => ({
      date: "2026-11-06",
      weekday: 5,
      minutes,
    });
    expect(inWindow(at(480), 480, 60)).toBe(true);
    expect(inWindow(at(539), 480, 60)).toBe(true);
    expect(inWindow(at(540), 480, 60)).toBe(false);
    expect(inWindow(at(479), 480, 60)).toBe(false);
  });
});

describe("inCatchUpWindow", () => {
  it("permits a bounded catch-up after quiet hours without extending forever", () => {
    const at = (minutes: number) => ({
      date: "2026-11-06",
      weekday: 5,
      minutes,
    });
    expect(inCatchUpWindow(at(9 * 60), 8 * 60, 60, 4 * 60)).toBe(true);
    expect(inCatchUpWindow(at(13 * 60), 8 * 60, 60, 4 * 60)).toBe(false);
  });
});

describe("isInQuietHours", () => {
  it("handles ranges that cross midnight", () => {
    // Quiet 22:00–07:00 Nairobi. 23:00 local is inside; 10:30 local is not.
    expect(
      isInQuietHours(
        "22:00",
        "07:00",
        "Africa/Nairobi",
        new Date("2026-11-06T20:00:00Z"),
      ),
    ).toBe(true); // 23:00 Nairobi
    expect(
      isInQuietHours("22:00", "07:00", "Africa/Nairobi", friday0730Utc),
    ).toBe(false);
  });

  it("is off when start equals end or is unset", () => {
    expect(
      isInQuietHours("09:00", "09:00", "Africa/Nairobi", friday0730Utc),
    ).toBe(false);
    expect(isInQuietHours(null, null, "Africa/Nairobi", friday0730Utc)).toBe(
      false,
    );
  });
});

describe("date helpers", () => {
  it("finds the Monday of the week for any weekday", () => {
    expect(weekStartOf("2026-11-06", 5)).toBe("2026-11-02"); // Friday
    expect(weekStartOf("2026-11-08", 0)).toBe("2026-11-02"); // Sunday
    expect(weekStartOf("2026-11-02", 1)).toBe("2026-11-02"); // Monday
  });

  it("adds days across month boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
  });
});
