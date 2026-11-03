import { describe, expect, it } from "vitest";
import {
  averageGoalProgress,
  computeStreak,
  countWorkdaysLogged,
} from "./my-week";

// Monday 2026-11-02 starts the week; Friday is 2026-11-06.
const WEEK = "2026-11-02";

describe("countWorkdaysLogged", () => {
  it("counts only Mon–Fri days with entries", () => {
    expect(
      countWorkdaysLogged(
        ["2026-11-02", "2026-11-04", "2026-11-08", "2026-11-09"],
        WEEK,
      ),
    ).toBe(2);
  });

  it("returns zero for an empty week", () => {
    expect(countWorkdaysLogged([], WEEK)).toBe(0);
  });
});

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(
      computeStreak(["2026-11-01", "2026-11-02", "2026-11-03"], "2026-11-03"),
    ).toBe(3);
  });

  it("keeps the streak alive when today is not logged yet", () => {
    expect(computeStreak(["2026-11-01", "2026-11-02"], "2026-11-03")).toBe(2);
  });

  it("resets after a gap", () => {
    expect(computeStreak(["2026-10-30", "2026-11-03"], "2026-11-03")).toBe(1);
  });

  it("is zero with no recent logs", () => {
    expect(computeStreak([], "2026-11-03")).toBe(0);
  });
});

describe("averageGoalProgress", () => {
  it("averages and rounds progress", () => {
    expect(averageGoalProgress([{ progress: 40 }, { progress: 55 }])).toBe(48);
  });

  it("returns null with no goals", () => {
    expect(averageGoalProgress([])).toBeNull();
  });
});
