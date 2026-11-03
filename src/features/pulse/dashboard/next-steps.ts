export type NextStepKind =
  | "review_acknowledgement"
  | "daily_log"
  | "weekly_checkin"
  | "survey"
  | "side_quest"
  | "hall_of_fame"
  | "one_on_one_prep"
  | "action_items";

export type NextStep = {
  kind: NextStepKind;
  title: string;
  description: string;
  urgency: string;
  tone: "urgent" | "soon" | "neutral";
  actionLabel: string;
  href: string;
};

export type OpenSurveySignal = { title: string; closesAt: Date | null };

export type HallOfFameSignal = {
  action: "nominate" | "vote";
  cycleTitle: string;
  closesAt: Date | null;
};

export type EmployeeNextStepInput = {
  /** Number of daily-log entries recorded for today (0 when missing). */
  todayLogEntries: number;
  /** Weekly check-in status for the current week, or null when not started. */
  checkinStatus: "draft" | "submitted" | "reviewed" | null;
  /** Released performance reviews the employee has not acknowledged yet. */
  unacknowledgedReviews: number;
  /** Active surveys the employee is invited to and has not answered. */
  openSurveys: OpenSurveySignal[];
  /** Live evidence-based Side Quests the employee has not completed. */
  outstandingSideQuests: number;
  /** Open Hall of Fame step for this employee, if any. */
  hallOfFame: HallOfFameSignal | null;
  /** Start of the next scheduled 1-on-1 the user is part of, if any. */
  nextOneOnOneAt: Date | null;
  /** Open action items on the relevant 1-on-1. */
  openActionItems: number;
  /** Reference time, injectable for tests. */
  now: Date;
};

const DAY_MS = 86_400_000;
const PREP_WINDOW_MS = 3 * DAY_MS;
const SURVEY_SOON_MS = 7 * DAY_MS;

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function daysLeft(date: Date, now: Date) {
  return Math.ceil((date.getTime() - now.getTime()) / DAY_MS);
}

function closingLabel(closesAt: Date | null, now: Date) {
  if (!closesAt) return "Open";
  const days = daysLeft(closesAt, now);
  if (days <= 0) return "Closes today";
  return days === 1 ? "Closes tomorrow" : `Closes in ${days} days`;
}

/**
 * Builds the employee's ranked "Your next step" queue.
 * Items are ordered by priority: released results and time-sensitive
 * requests first, then routine work. Completed items are omitted, so each
 * one disappears as soon as the underlying action is done. Only the first
 * item is the primary next step.
 */
export function buildEmployeeNextSteps(
  input: EmployeeNextStepInput,
): NextStep[] {
  const steps: NextStep[] = [];

  if (input.unacknowledgedReviews > 0) {
    steps.push({
      kind: "review_acknowledgement",
      title: "Acknowledge your review",
      description:
        input.unacknowledgedReviews === 1
          ? "Your review results have been released. Read them and add your response."
          : `${input.unacknowledgedReviews} review results have been released and need your response.`,
      urgency: "Released",
      tone: "urgent",
      actionLabel: "Review results",
      href: "/pulse/reviews",
    });
  }

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

  if (input.openSurveys.length > 0) {
    const [soonest] = [...input.openSurveys].sort(
      (a, b) =>
        (a.closesAt?.getTime() ?? Infinity) -
        (b.closesAt?.getTime() ?? Infinity),
    );
    const closingSoon =
      soonest.closesAt !== null &&
      soonest.closesAt.getTime() - input.now.getTime() <= SURVEY_SOON_MS;
    steps.push({
      kind: "survey",
      title: soonest.title,
      description:
        input.openSurveys.length > 1
          ? `${plural(input.openSurveys.length, "survey")} waiting for your response.`
          : "A survey is waiting for your response.",
      urgency: closingLabel(soonest.closesAt, input.now),
      tone: closingSoon ? "urgent" : "soon",
      actionLabel: "Respond",
      href: "/pulse/surveys",
    });
  }

  if (input.outstandingSideQuests > 0) {
    steps.push({
      kind: "side_quest",
      title: "Side Quest evidence",
      description: `${plural(input.outstandingSideQuests, "live Side Quest")} need evidence from you.`,
      urgency: "Live",
      tone: "neutral",
      actionLabel: "Open Side Quests",
      href: "/pulse/side-quests",
    });
  }

  if (input.hallOfFame) {
    const voting = input.hallOfFame.action === "vote";
    steps.push({
      kind: "hall_of_fame",
      title: voting ? "Vote for Hall of Fame" : "Nominate for Hall of Fame",
      description: voting
        ? `Voting is open for ${input.hallOfFame.cycleTitle}.`
        : `Recognise a colleague for ${input.hallOfFame.cycleTitle}.`,
      urgency: closingLabel(input.hallOfFame.closesAt, input.now),
      tone: "soon",
      actionLabel: voting ? "Vote" : "Nominate",
      href: "/pulse/hall-of-fame",
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
