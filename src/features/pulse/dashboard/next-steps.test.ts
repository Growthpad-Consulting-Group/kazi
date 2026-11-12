import { describe, expect, it } from "vitest";
import {
  buildEmployeeNextSteps,
  type EmployeeNextStepInput,
} from "./next-steps";

const now = new Date("2026-11-03T09:00:00Z");
const DAY = 86_400_000;

function input(
  overrides: Partial<EmployeeNextStepInput> = {},
): EmployeeNextStepInput {
  return {
    todayLogEntries: 0,
    checkinStatus: null,
    unacknowledgedReviews: 0,
    openSurveys: [],
    outstandingSideQuests: 0,
    wallOfFame: null,
    nextOneOnOneAt: null,
    openActionItems: 0,
    now,
    ...overrides,
  };
}

const settled = { todayLogEntries: 1, checkinStatus: "submitted" as const };

describe("employee queue signals", () => {
  it("puts released review acknowledgements first", () => {
    const steps = buildEmployeeNextSteps(
      input({ ...settled, unacknowledgedReviews: 1, todayLogEntries: 0 }),
    );
    expect(steps[0].kind).toBe("review_acknowledgement");
    expect(steps[0].href).toBe("/pulse/reviews");
    expect(steps[1].kind).toBe("daily_log");
  });

  it("marks a survey closing within a week as urgent", () => {
    const closes = new Date(now.getTime() + 2 * DAY);
    const [step] = buildEmployeeNextSteps(
      input({
        ...settled,
        openSurveys: [{ title: "Pulse survey", closesAt: closes }],
      }),
    );
    expect(step.kind).toBe("survey");
    expect(step.tone).toBe("urgent");
    expect(step.urgency).toBe("Closes in 2 days");
    expect(step.title).toBe("Pulse survey");
  });

  it("uses the soonest closing survey and counts the rest", () => {
    const [step] = buildEmployeeNextSteps(
      input({
        ...settled,
        openSurveys: [
          { title: "Later", closesAt: new Date(now.getTime() + 20 * DAY) },
          { title: "Sooner", closesAt: new Date(now.getTime() + 3 * DAY) },
        ],
      }),
    );
    expect(step.title).toBe("Sooner");
    expect(step.description).toBe("2 surveys waiting for your response.");
  });

  it("shows outstanding Side Quest evidence and Wall of Fame steps", () => {
    const steps = buildEmployeeNextSteps(
      input({
        ...settled,
        outstandingSideQuests: 2,
        wallOfFame: {
          action: "nominate",
          cycleTitle: "November",
          closesAt: null,
        },
      }),
    );
    expect(steps.map((s) => s.kind)).toEqual(["side_quest", "wall_of_fame"]);
    expect(steps[0].description).toBe(
      "2 live Side Quests need evidence from you.",
    );
    expect(steps[1].actionLabel).toBe("Nominate");
  });
});

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
