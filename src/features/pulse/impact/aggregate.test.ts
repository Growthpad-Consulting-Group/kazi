import { describe, expect, it } from "vitest";
import {
  bucketWeeks,
  countByMonth,
  mondayOf,
  recentMonths,
  recentWeekStarts,
} from "./aggregate";

describe("mondayOf", () => {
  it("returns the Monday of the week, including for Sundays", () => {
    expect(mondayOf("2026-11-04")).toBe("2026-11-02"); // Wednesday
    expect(mondayOf("2026-11-08")).toBe("2026-11-02"); // Sunday
    expect(mondayOf("2026-11-02")).toBe("2026-11-02");
  });
});

describe("recentWeekStarts", () => {
  it("returns consecutive Mondays ending with the current week", () => {
    expect(recentWeekStarts("2026-11-04", 3)).toEqual([
      "2026-10-19",
      "2026-10-26",
      "2026-11-02",
    ]);
  });
});

describe("bucketWeeks", () => {
  it("totals minutes and logged workdays per week", () => {
    const rows = [
      { log_date: "2026-11-02", entries: [{ minutes: 60 }, { minutes: 30 }] },
      { log_date: "2026-11-03", entries: [{ minutes: 45 }] },
      { log_date: "2026-11-07", entries: [{ minutes: 20 }] },
      { log_date: "2026-10-26", entries: [] },
    ];
    expect(bucketWeeks(rows, ["2026-10-26", "2026-11-02"])).toEqual([
      { weekStart: "2026-10-26", minutes: 0, workdaysLogged: 0 },
      { weekStart: "2026-11-02", minutes: 155, workdaysLogged: 2 },
    ]);
  });
});

describe("countByMonth and recentMonths", () => {
  it("counts dates into each month", () => {
    expect(
      countByMonth(
        ["2026-10-05", "2026-11-01", "2026-11-09"],
        ["2026-10", "2026-11"],
      ),
    ).toEqual([
      { month: "2026-10", count: 1 },
      { month: "2026-11", count: 2 },
    ]);
  });

  it("returns month keys across a year boundary", () => {
    expect(recentMonths("2026-02-10", 3)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
});
