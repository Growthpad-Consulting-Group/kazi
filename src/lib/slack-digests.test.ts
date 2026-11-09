import { describe, expect, it } from "vitest";
import {
  buildCheckinNudge,
  buildCheckinSubmissionConfirmation,
  buildCheckinReviewReminder,
  buildDailyBrief,
  buildHallOfFameClosingReminder,
  buildInterviewReminder,
  buildManagerMondayPulse,
  buildManagerReviewQueue,
  buildOneOnOneFollowUp,
  buildOneOnOneReminder,
  buildPublicRecognitionMessage,
  buildRecognitionReceivedMessage,
  buildReviewAcknowledgementReminder,
  buildTimerRunningReminder,
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

  it("personalises the pulse while keeping direct-report details private", () => {
    const pulse = buildManagerMondayPulse({
      firstName: "Emmanuel",
      missingCheckins: 2,
      flagged: 1,
      appUrl,
    });
    const serialised = JSON.stringify(pulse!.blocks);
    expect(pulse!.text).toBe("Emmanuel, your team pulse needs attention");
    expect(serialised).toContain("Hi Emmanuel");
    expect(serialised).toContain("2 of your team have not submitted");
    expect(serialised).toContain("1 check-in flagged");
  });

  it("skips the Friday review queue when nothing is awaiting review", () => {
    expect(buildManagerReviewQueue({ awaitingReview: 0, appUrl })).toBeNull();
    expect(
      buildManagerReviewQueue({ awaitingReview: 1, appUrl })!.text,
    ).toContain("1 direct-report check-in is ready for your review");
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
    ).toBe("your 1-on-1 with Juma starts at 14:00.");
    expect(buildCheckinNudge({ appUrl }).blocks).toHaveLength(3);
  });
});

describe("weekly check-in confirmations", () => {
  it("confirms submission without including private check-in content", () => {
    const message = buildCheckinSubmissionConfirmation({
      appUrl,
      weekStart: "2026-11-02",
    });
    expect(message.text).toContain("has been submitted to your manager");
    expect(message.text).not.toContain("blocker");
    expect(JSON.stringify(message.blocks)).toContain(
      "View your submitted check-in in Kazi",
    );
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
    expect(JSON.stringify(message.blocks)).toContain("Open interview kit");
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

  it("uses singular wording for the final-day reminder", () => {
    expect(
      buildHallOfFameClosingReminder({ daysRemaining: 1, appUrl }).text,
    ).toContain("close in 1 day.");
  });

  it("uses closing-day wording when the cycle closes today", () => {
    expect(
      buildHallOfFameClosingReminder({ daysRemaining: 0, appUrl }).text,
    ).toContain("close today.");
  });
});

describe("recognition messages", () => {
  it("keeps the recipient notification private and actionable", () => {
    const message = buildRecognitionReceivedMessage({
      senderName: "Duncan",
      valueName: "Customer focus",
      message: "You made the client feel heard.",
      appUrl,
    });
    expect(message.text).toBe("Duncan recognised you for Customer focus.");
    expect(JSON.stringify(message.blocks)).toContain(
      "View recognition in Kazi",
    );
  });

  it("includes an image only when a public recipient is named", () => {
    const named = buildPublicRecognitionMessage({
      recipientName: "Antony",
      senderName: "Duncan",
      valueName: "Customer focus",
      message: "Excellent work.",
      mediaUrl: "https://example.com/celebrate.gif",
      appUrl,
    });
    expect(named.text).toContain("Antony was recognised by Duncan");
    expect(JSON.stringify(named.blocks)).toContain("celebrate.gif");

    const anonymous = buildPublicRecognitionMessage({
      recipientName: null,
      senderName: null,
      message: "Excellent work.",
      mediaUrl: "https://example.com/celebrate.gif",
      appUrl,
    });
    expect(JSON.stringify(anonymous.blocks)).not.toContain("celebrate.gif");
  });
});

describe("long-running timer reminders", () => {
  it("keeps the timer reminder private, actionable and short", () => {
    const reminder = buildTimerRunningReminder({
      task: "Prepare client proposal",
      elapsedHours: 8,
      urgent: false,
      appUrl,
    });
    expect(reminder.text).toContain("8 hours");
    expect(JSON.stringify(reminder.blocks)).toContain(
      "Open and stop timer in Kazi",
    );
  });

  it("uses a stronger message before the daily limit", () => {
    expect(
      buildTimerRunningReminder({
        task: "Prepare client proposal",
        elapsedHours: 20,
        urgent: true,
        appUrl,
      }).text,
    ).toContain("Stop it now");
  });
});

describe("daily brief with Asana counts", () => {
  it("shows Asana counts without task titles", () => {
    const brief = buildDailyBrief({
      firstName: "Amina",
      meetings: [],
      goalsDueSoon: 0,
      logMissing: false,
      checkinPending: false,
      asanaDueToday: 2,
      asanaOverdue: 1,
      appUrl,
    });
    const serialised = JSON.stringify(brief!.blocks);
    expect(brief!.text).toBe(
      "Good morning Amina. Today in Kazi: 2 items to look at.",
    );
    expect(serialised).toContain("Asana overdue:* 1 task");
    expect(serialised).toContain("Asana due today:* 2 tasks");
  });

  it("still suppresses when only zero Asana counts are present", () => {
    expect(
      buildDailyBrief({
        firstName: "Amina",
        meetings: [],
        goalsDueSoon: 0,
        logMissing: false,
        checkinPending: false,
        asanaDueToday: 0,
        asanaOverdue: 0,
        appUrl,
      }),
    ).toBeNull();
  });
});

describe("Monday pulse queue lines", () => {
  it("sends when only attention-queue items are waiting", () => {
    const pulse = buildManagerMondayPulse({
      missingCheckins: 0,
      flagged: 0,
      queueLines: ["3 reward redemptions"],
      appUrl,
    });
    expect(pulse).not.toBeNull();
    expect(JSON.stringify(pulse!.blocks)).toContain("3 reward redemptions");
  });
});

describe("review acknowledgement buttons", () => {
  it("offers Acknowledge only when exactly one review is outstanding", () => {
    const single = buildReviewAcknowledgementReminder({
      outstanding: 1,
      singleReviewId: "review-1",
      appUrl,
    });
    expect(JSON.stringify(single!.blocks)).toContain("acknowledge_review");
    expect(JSON.stringify(single!.blocks)).toContain("snooze_reminder");

    const several = buildReviewAcknowledgementReminder({
      outstanding: 2,
      singleReviewId: null,
      appUrl,
    });
    expect(JSON.stringify(several!.blocks)).not.toContain("acknowledge_review");
    expect(JSON.stringify(several!.blocks)).toContain("snooze_reminder");
  });

  it("keeps check-in reminder buttons to one review action and one snooze", () => {
    const message = buildCheckinReviewReminder({
      appUrl,
      employeeId: "emp-1",
      weekStart: "2026-11-02",
    });
    const serialised = JSON.stringify(message.blocks);
    expect(serialised).toContain("mark_checkin_reviewed");
    expect(serialised).toContain("checkin_review|emp-1|2026-11-02");
  });
});
