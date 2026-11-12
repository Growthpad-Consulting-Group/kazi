import { describe, expect, it } from "vitest";
import { resolveWallOfFameStage } from "./wall-of-fame-stage";

const cycle = {
  status: "open",
  closes_at: "2026-11-10",
  team_voting_opens_at: "2026-11-07",
  management_voting_opens_at: "2026-11-12",
};

describe("resolveWallOfFameStage", () => {
  it("keeps nominations open until the closing day", () => {
    expect(
      resolveWallOfFameStage(
        {
          ...cycle,
          team_voting_opens_at: null,
          management_voting_opens_at: null,
        },
        "2026-11-10",
      ),
    ).toBe("open");
  });

  it("moves to team voting once the date arrives, even if the status is still open", () => {
    expect(
      resolveWallOfFameStage(
        { ...cycle, management_voting_opens_at: null },
        "2026-11-08",
      ),
    ).toBe("team_voting");
  });

  it("moves to management voting when its date arrives", () => {
    expect(resolveWallOfFameStage(cycle, "2026-11-12")).toBe(
      "management_voting",
    );
  });

  it("never shows open after nominations have closed", () => {
    expect(
      resolveWallOfFameStage(
        {
          ...cycle,
          team_voting_opens_at: null,
          management_voting_opens_at: null,
        },
        "2026-11-11",
      ),
    ).toBe("closed");
  });

  it("respects a stage an admin set ahead of the dates", () => {
    expect(
      resolveWallOfFameStage(
        { ...cycle, status: "management_voting" },
        "2026-11-01",
      ),
    ).toBe("management_voting");
  });

  it("keeps published as the final stage", () => {
    expect(
      resolveWallOfFameStage({ ...cycle, status: "published" }, "2026-11-01"),
    ).toBe("published");
  });

  it("falls back to open for an unknown or missing status", () => {
    expect(
      resolveWallOfFameStage(
        {
          ...cycle,
          status: null,
          closes_at: null,
          team_voting_opens_at: null,
          management_voting_opens_at: null,
        },
        "2026-11-01",
      ),
    ).toBe("open");
  });
});
