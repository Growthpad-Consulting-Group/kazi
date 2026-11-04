import { describe, expect, it } from "vitest";
import {
  buildCheckinNudge,
  buildDailyBrief,
  buildHallOfFameClosingReminder,
  buildInterviewReminder,
  buildManagerMondayPulse,
  buildManagerReviewQueue,
  buildOneOnOneFollowUp,
  buildOneOnOneReminder,
} from "./slack-digests";

const appUrl = "https://kazi.example";

const emptyBrief = {
  firstName: "Amina",
  meetings: [],
  goalsDueSoon: 0,
  logMissing: false,
  checkinPending: false,
  appUrl,
};

describe("buildDailyBrief", () => {
  it("is suppressed when nothing is actionable", () => {
    expect(buildDailyBrief(emptyBrief)).toBeNull();
  });

  it("lists actionable items with one Kazi link", () => {
    const brief = buildDailyBrief({
      ...emptyBrief,
      meetings: [{ withName: "Juma", time: "10:00" }],
      logMissing: true,
    });
    expect(brief).not.toBeNull();
    expect(brief!.text).toBe(
      "Good morning Amina. Today in Kazi: 2 items to look at.",
    );
    const serialised = JSON.stringify(brief!.blocks);
    expect(serialised).toContain("1-on-1s today:* 10:00 with Juma");
    expect(serialised.match(/kazi\.example/g)).toHaveLength(1);
  });

  it("uses singular wording for a single goal", () => {
    const brief = buildDailyBrief({ ...emptyBrief, goalsDueSoon: 1 });
    expect(JSON.stringify(brief!.blocks)).toContain("1 goal due");
  });
});

describe("manager digests", () => {
  it("skips the Monday pulse when the team is up to date", () => {
    expect(
      buildManagerMondayPulse({ missingCheckins: 0, flagged: 0, appUrl }),
    ).toBeNull();
  });

  it("reports counts only, never names or blocker text", () => {
    const pulse = buildManagerMondayPulse({
      missingCheckins: 2,
      flagged: 1,
      appUrl,
    });
    const serialised = JSON.stringify(pulse!.blocks);
    expect(serialised).toContain("2 of your team have not submitted");
    expect(serialised).toContain("1 check-in flagged");
  });

  it("skips the Friday review queue when nothing is awaiting review", () => {
    expect(buildManagerReviewQueue({ awaitingReview: 0, appUrl })).toBeNull();
    expect(
      buildManagerReviewQueue({ awaitingReview: 1, appUrl })!.text,
    ).toContain("1 check-in is waiting");
  });
});

describe("one-on-one and nudge messages", () => {
  it("links 1-on-1 follow-ups to the source record", () => {
    const message = buildOneOnOneFollowUp({
      withName: "Juma",
      appUrl,
      meetingId: "abc",
    });
    expect(JSON.stringify(message.blocks)).toContain(
      "https://kazi.example/pulse/one-on-ones/abc",
    );
  });

  it("keeps the reminder and nudge copy short with one link", () => {
    expect(
      buildOneOnOneReminder({ withName: "Juma", time: "14:00", appUrl }).text,
    ).toBe("1-on-1 with Juma starts at 14:00.");
    expect(buildCheckinNudge(appUrl).blocks).toHaveLength(2);
  });
});

describe("interview reminders", () => {
  it("contains only the candidate, role and Kazi link", () => {
    const message = buildInterviewReminder({
      candidateName: "Amina Njeri",
      roleTitle: "Business Analyst",
      time: "10:00",
      appUrl,
    });
    expect(message.text).toContain("Amina Njeri");
    expect(message.text).toContain("Business Analyst");
    expect(JSON.stringify(message.blocks)).toContain("Open interviews in Kazi");
  });
});

describe("Wall of Fame reminders", () => {
  it("uses a culture-safe channel message and one deep link", () => {
    const message = buildHallOfFameClosingReminder({
      daysRemaining: 3,
      appUrl,
    });
    expect(message.text).toContain("close in 3 days");
    expect(JSON.stringify(message.blocks)).toContain(
      "Open Wall of Fame in Kazi",
    );
  });
});
