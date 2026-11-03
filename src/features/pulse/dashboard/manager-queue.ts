export type AttentionKind =
  | "flagged_team_member"
  | "voice_out_case"
  | "overtime_request"
  | "checkin_review"
  | "review_to_complete"
  | "reward_redemption"
  | "side_quest_approval";

export type AttentionItem = {
  id: AttentionKind;
  title: string;
  /** Why this needs the viewer's attention, stated plainly. */
  reason: string;
  urgency: "urgent" | "soon" | "neutral";
  actionLabel: string;
  href: string;
};

export type ManagerAttentionSignals = {
  /** Direct reports whose check-in is flagged with a blocker or low mood this week. */
  flaggedReports: { name: string; reason: "blocker" | "low_mood" }[];
  /** Voice Out cases assigned to the viewer that are still open. Counts only. */
  openVoiceOutCases: number | null;
  /** Pending overtime requests from the viewer's scope. */
  pendingOvertime: number;
  /** Submitted check-ins from direct reports still awaiting review. */
  checkinsAwaitingReview: number;
  /** Performance reviews the viewer still has to complete. */
  reviewsToComplete: number;
  /** Pending reward redemptions, or null when the viewer cannot approve them. */
  pendingRedemptions: number | null;
  /** Side Quest completions awaiting approval, or null when not permitted. */
  pendingQuestApprovals: number | null;
};

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function joinNames(names: string[]) {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

/**
 * Ranks what needs the viewer's action, most urgent first. Each item states why
 * it needs attention and links to one safe place to act. Voice Out cases are
 * counted but never named, so anonymous or sensitive detail stays out of the
 * generic queue.
 */
export function buildManagerAttention(
  signals: ManagerAttentionSignals,
): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (signals.flaggedReports.length) {
    const blockers = signals.flaggedReports.filter(
      (r) => r.reason === "blocker",
    );
    const lowMood = signals.flaggedReports.filter(
      (r) => r.reason === "low_mood",
    );
    const parts: string[] = [];
    if (blockers.length)
      parts.push(
        `${joinNames(blockers.map((r) => r.name))} reported a blocker`,
      );
    if (lowMood.length)
      parts.push(`${joinNames(lowMood.map((r) => r.name))} marked low mood`);
    items.push({
      id: "flagged_team_member",
      title: plural(signals.flaggedReports.length, "team member") + " flagged",
      reason: parts.join("; ") + " this week.",
      urgency: "urgent",
      actionLabel: "Review team",
      href: "/pulse/checkins?tab=team",
    });
  }

  if (signals.openVoiceOutCases) {
    items.push({
      id: "voice_out_case",
      title: plural(signals.openVoiceOutCases, "Voice Out case"),
      reason: "Assigned to you and still open.",
      urgency: "urgent",
      actionLabel: "Open Voice Out",
      href: "/pulse/voice-out",
    });
  }

  if (signals.pendingOvertime) {
    items.push({
      id: "overtime_request",
      title: plural(signals.pendingOvertime, "overtime request"),
      reason: "Outside-hours time is waiting for approval.",
      urgency: "soon",
      actionLabel: "Review requests",
      href: "/pulse/checkins?tab=team",
    });
  }

  if (signals.checkinsAwaitingReview) {
    items.push({
      id: "checkin_review",
      title: plural(signals.checkinsAwaitingReview, "check-in") + " to review",
      reason: "Submitted this week by your team and not yet reviewed.",
      urgency: "soon",
      actionLabel: "Review check-ins",
      href: "/pulse/checkins?tab=team",
    });
  }

  if (signals.reviewsToComplete) {
    items.push({
      id: "review_to_complete",
      title: plural(signals.reviewsToComplete, "review") + " to complete",
      reason: "Performance reviews assigned to you are still open.",
      urgency: "soon",
      actionLabel: "Open reviews",
      href: "/pulse/reviews",
    });
  }

  if (signals.pendingRedemptions) {
    items.push({
      id: "reward_redemption",
      title: plural(signals.pendingRedemptions, "reward redemption"),
      reason: "Waiting for approval before fulfilment.",
      urgency: "neutral",
      actionLabel: "Review redemptions",
      href: "/pulse/rewards",
    });
  }

  if (signals.pendingQuestApprovals) {
    items.push({
      id: "side_quest_approval",
      title: plural(signals.pendingQuestApprovals, "Side Quest completion"),
      reason: "Submitted and awaiting approval.",
      urgency: "neutral",
      actionLabel: "Review completions",
      href: "/pulse/side-quests",
    });
  }

  return items;
}
