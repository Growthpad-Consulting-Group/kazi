import { describe, expect, it } from "vitest";
import {
  buildManagerAttention,
  type ManagerAttentionSignals,
} from "./manager-queue";

const empty: ManagerAttentionSignals = {
  flaggedReports: [],
  openVoiceOutCases: 0,
  pendingOvertime: 0,
  checkinsAwaitingReview: 0,
  overdueScorecards: null,
  reviewsToComplete: 0,
  pendingRedemptions: null,
  pendingQuestApprovals: null,
};

describe("buildManagerAttention", () => {
  it("returns nothing when the queue is clear", () => {
    expect(buildManagerAttention(empty)).toEqual([]);
  });

  it("ranks flagged team members first and names them with a reason", () => {
    const items = buildManagerAttention({
      ...empty,
      checkinsAwaitingReview: 2,
      flaggedReports: [
        { name: "Amina", reason: "blocker" },
        { name: "Juma", reason: "low_mood" },
      ],
    });
    expect(items.map((i) => i.id)).toEqual([
      "flagged_team_member",
      "checkin_review",
    ]);
    expect(items[0].reason).toBe(
      "Amina reported a blocker; Juma marked low mood this week.",
    );
    expect(items[0].urgency).toBe("urgent");
  });

  it("counts Voice Out cases without naming anyone", () => {
    const [item] = buildManagerAttention({ ...empty, openVoiceOutCases: 3 });
    expect(item.title).toBe("3 Voice Out cases");
    expect(item.href).toBe("/pulse/voice-out");
    expect(item.reason).not.toMatch(/from|by /i);
  });

  it("hides admin-only approvals when the viewer cannot approve them", () => {
    const items = buildManagerAttention({
      ...empty,
      pendingRedemptions: null,
      pendingQuestApprovals: null,
    });
    expect(items).toEqual([]);
  });

  it("shows admin approvals when permitted, ranked after team work", () => {
    const items = buildManagerAttention({
      ...empty,
      pendingOvertime: 1,
      pendingRedemptions: 4,
      pendingQuestApprovals: 1,
    });
    expect(items.map((i) => i.id)).toEqual([
      "overtime_request",
      "reward_redemption",
      "side_quest_approval",
    ]);
    expect(items[1].title).toBe("4 reward redemptions");
  });

  it("surfaces overdue interviewer scorecards without candidate detail", () => {
    const [item] = buildManagerAttention({
      ...empty,
      overdueScorecards: 2,
    });
    expect(item).toMatchObject({
      id: "overdue_scorecard",
      title: "2 interview scorecards overdue",
      href: "/hire/candidates?stage=interview",
    });
    expect(item.reason).not.toMatch(/candidate/i);
  });
});
