export type NextStepKind =
  "daily_log" | "weekly_checkin" | "one_on_one_prep" | "action_items";

export type NextStep = {
  kind: NextStepKind;
  title: string;
  description: string;
  urgency: string;
  tone: "urgent" | "soon" | "neutral";
  actionLabel: string;
  href: string;
};

export type EmployeeNextStepInput = {
  /** Number of daily-log entries recorded for today (0 when missing). */
  todayLogEntries: number;
  /** Weekly check-in status for the current week, or null when not started. */
  checkinStatus: "draft" | "submitted" | "reviewed" | null;
  /** Start of the next scheduled 1-on-1 the user is part of, if any. */
  nextOneOnOneAt: Date | null;
  /** Open action items on that 1-on-1. */
  openActionItems: number;
  /** Reference time, injectable for tests. */
  now: Date;
};

const DAY_MS = 86_400_000;
const PREP_WINDOW_MS = 3 * DAY_MS;

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * Builds the employee's ranked "Your next step" queue.
 * Completed items are omitted, so each one disappears as soon as the
 * underlying action is done. Only the first item is the primary next step.
 */
export function buildEmployeeNextSteps(
  input: EmployeeNextStepInput,
): NextStep[] {
  const steps: NextStep[] = [];

  if (input.todayLogEntries === 0) {
    steps.push({
      kind: "daily_log",
      title: "Log today's activity",
      description:
        "Note what you worked on and how long it took before you finish for the day.",
      urgency: "Today",
      tone: "urgent",
      actionLabel: "Log activity",
      href: "/pulse/checkins?tab=daily",
    });
  }

  if (
    input.checkinStatus !== "submitted" &&
    input.checkinStatus !== "reviewed"
  ) {
    const inProgress = input.checkinStatus === "draft";
    steps.push({
      kind: "weekly_checkin",
      title: "Weekly check-in",
      description: inProgress
        ? "You have a draft saved. Finish it to share this week's update."
        : "Share how this week went, your mood and any blockers.",
      urgency: inProgress ? "In progress" : "This week",
      tone: inProgress ? "soon" : "neutral",
      actionLabel: inProgress ? "Finish draft" : "Check in",
      href: "/pulse/checkins",
    });
  }

  if (input.nextOneOnOneAt) {
    const untilMs = input.nextOneOnOneAt.getTime() - input.now.getTime();
    if (untilMs >= 0 && untilMs <= PREP_WINDOW_MS) {
      const days = Math.ceil(untilMs / DAY_MS);
      steps.push({
        kind: "one_on_one_prep",
        title: "Prepare for your 1-on-1",
        description:
          input.openActionItems > 0
            ? `${plural(input.openActionItems, "open action item")} to review before the meeting.`
            : "Add topics you want to cover before the meeting.",
        urgency: days <= 1 ? "Soon" : `In ${days} days`,
        tone: days <= 1 ? "urgent" : "soon",
        actionLabel: "Prepare",
        href: "/pulse/one-on-ones",
      });
    }
  }

  if (
    input.openActionItems > 0 &&
    !steps.some((s) => s.kind === "one_on_one_prep")
  ) {
    steps.push({
      kind: "action_items",
      title: "Follow up on action items",
      description: `${plural(input.openActionItems, "open action item")} from your recent conversation.`,
      urgency: "Open",
      tone: "neutral",
      actionLabel: "Review",
      href: "/pulse/one-on-ones",
    });
  }

  return steps;
}
