import { describe, expect, it } from "vitest";
import { buildTeamTrend, trailingWeekStarts } from "./team-trend";

describe("trailingWeekStarts", () => {
  it("returns consecutive weeks ending with the given week", () => {
    expect(trailingWeekStarts("2026-11-02", 3)).toEqual([
      "2026-10-19",
      "2026-10-26",
      "2026-11-02",
    ]);
  });
});

describe("buildTeamTrend", () => {
  const weeks = ["2026-10-26", "2026-11-02"];

  it("aggregates coverage, blockers and mood across the team", () => {
    const trend = buildTeamTrend(
      [
        {
          week_start: "2026-11-02",
          status: "submitted",
          mood: 4,
          blockers: null,
        },
        {
          week_start: "2026-11-02",
          status: "reviewed",
          mood: 2,
          blockers: "Waiting on access",
        },
        {
          week_start: "2026-11-02",
          status: "draft",
          mood: null,
          blockers: null,
        },
      ],
      4,
      weeks,
    );
    expect(trend[1]).toEqual({
      weekStart: "2026-11-02",
      coverage: 50,
      blockers: 1,
      averageMood: 3,
    });
  });

  it("returns empty figures for weeks with no check-ins", () => {
    const [empty] = buildTeamTrend([], 3, ["2026-10-26"]);
    expect(empty).toEqual({
      weekStart: "2026-10-26",
      coverage: 0,
      blockers: 0,
      averageMood: null,
    });
  });

  it("does not divide by zero when the team has no reports", () => {
    const [week] = buildTeamTrend([], 0, ["2026-10-26"]);
    expect(week.coverage).toBe(0);
  });
});
