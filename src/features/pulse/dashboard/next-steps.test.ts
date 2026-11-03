import { describe, expect, it } from "vitest";
import {
  buildEmployeeNextSteps,
  type EmployeeNextStepInput,
} from "./next-steps";

const now = new Date("2026-11-03T09:00:00Z");

function input(
  overrides: Partial<EmployeeNextStepInput> = {},
): EmployeeNextStepInput {
  return {
    todayLogEntries: 0,
    checkinStatus: null,
    nextOneOnOneAt: null,
    openActionItems: 0,
    now,
    ...overrides,
  };
}

describe("buildEmployeeNextSteps", () => {
  it("ranks the daily log first when today is not logged", () => {
    const steps = buildEmployeeNextSteps(input());
    expect(steps.map((s) => s.kind)).toEqual(["daily_log", "weekly_checkin"]);
    expect(steps[0].href).toBe("/pulse/checkins?tab=daily");
  });

  it("removes the daily log step once today has entries", () => {
    const steps = buildEmployeeNextSteps(input({ todayLogEntries: 2 }));
    expect(steps.some((s) => s.kind === "daily_log")).toBe(false);
  });

  it("removes the weekly check-in once submitted or reviewed", () => {
    expect(
      buildEmployeeNextSteps(
        input({ checkinStatus: "submitted", todayLogEntries: 1 }),
      ),
    ).toEqual([]);
    expect(
      buildEmployeeNextSteps(
        input({ checkinStatus: "reviewed", todayLogEntries: 1 }),
      ),
    ).toEqual([]);
  });

  it("shows a draft check-in as in progress", () => {
    const [step] = buildEmployeeNextSteps(
      input({ checkinStatus: "draft", todayLogEntries: 1 }),
    );
    expect(step.kind).toBe("weekly_checkin");
    expect(step.urgency).toBe("In progress");
    expect(step.actionLabel).toBe("Finish draft");
  });

  it("surfaces 1-on-1 preparation only inside the 3-day window", () => {
    const soon = new Date(now.getTime() + 36 * 3_600_000);
    const later = new Date(now.getTime() + 6 * 86_400_000);
    const withSoon = buildEmployeeNextSteps(
      input({
        todayLogEntries: 1,
        checkinStatus: "submitted",
        nextOneOnOneAt: soon,
      }),
    );
    expect(withSoon.map((s) => s.kind)).toEqual(["one_on_one_prep"]);
    expect(withSoon[0].tone).toBe("soon");

    const withLater = buildEmployeeNextSteps(
      input({
        todayLogEntries: 1,
        checkinStatus: "submitted",
        nextOneOnOneAt: later,
      }),
    );
    expect(withLater).toEqual([]);
  });

  it("does not repeat open action items when 1-on-1 prep already covers them", () => {
    const soon = new Date(now.getTime() + 2 * 3_600_000);
    const steps = buildEmployeeNextSteps(
      input({
        todayLogEntries: 1,
        checkinStatus: "submitted",
        nextOneOnOneAt: soon,
        openActionItems: 2,
      }),
    );
    expect(steps.map((s) => s.kind)).toEqual(["one_on_one_prep"]);
    expect(steps[0].description).toContain("2 open action items");
  });

  it("returns an empty queue when nothing is outstanding", () => {
    expect(
      buildEmployeeNextSteps(
        input({ todayLogEntries: 3, checkinStatus: "reviewed" }),
      ),
    ).toEqual([]);
  });
});
