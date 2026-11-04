// Message builders for scheduled Slack digests. Each returns null when there is
// nothing actionable, so an empty digest is never sent. Bodies carry counts and
// names only where the recipient already has access to them.

export type SlackMessage = { text: string; blocks: object[] };

export type BriefMeeting = { withName: string; time: string };

export function buildDailyBrief(input: {
  firstName: string;
  meetings: BriefMeeting[];
  goalsDueSoon: number;
  logMissing: boolean;
  checkinPending: boolean;
  /** Counts from the owner's own Asana work. Task titles are never included. */
  asanaDueToday?: number;
  asanaOverdue?: number;
  appUrl: string;
}): SlackMessage | null {
  const lines: string[] = [];
  if (input.meetings.length) {
    const list = input.meetings
      .map((meeting) => `${meeting.time} with ${meeting.withName}`)
      .join(", ");
    lines.push(`*1-on-1s today:* ${list}`);
  }
  if (input.goalsDueSoon > 0)
    lines.push(
      `*Goals due soon:* ${input.goalsDueSoon} ${input.goalsDueSoon === 1 ? "goal" : "goals"} due in the next few days`,
    );
  if (input.asanaOverdue && input.asanaOverdue > 0)
    lines.push(
      `*Asana overdue:* ${input.asanaOverdue} ${input.asanaOverdue === 1 ? "task" : "tasks"} past due`,
    );
  if (input.asanaDueToday && input.asanaDueToday > 0)
    lines.push(
      `*Asana due today:* ${input.asanaDueToday} ${input.asanaDueToday === 1 ? "task" : "tasks"}`,
    );
  if (input.logMissing) lines.push("*Daily log:* today is not logged yet");
  if (input.checkinPending)
    lines.push("*Weekly check-in:* still to submit this week");
  if (!lines.length) return null;

  const link = `${input.appUrl}/pulse`;
  const text = `Good morning ${input.firstName}. Today in Kazi: ${lines.length} item${lines.length === 1 ? "" : "s"} to look at.`;
  return {
    text,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "Your day in Kazi" },
      },
      { type: "section", text: { type: "mrkdwn", text: lines.join("\n") } },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: `<${link}|Open today in Kazi>` }],
      },
    ],
  };
}

export function buildCheckinNudge(appUrl: string): SlackMessage {
  const text =
    "Your weekly reflection is still open. A few minutes now helps your manager and keeps your week on track.";
  return {
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<${appUrl}/pulse/checkins|Open weekly check-in>`,
          },
        ],
      },
    ],
  };
}

export function buildManagerMondayPulse(input: {
  missingCheckins: number;
  flagged: number;
  /** Counts-only lines from the manager's Needs attention queue. */
  queueLines?: string[];
  appUrl: string;
}): SlackMessage | null {
  const queueLines = input.queueLines ?? [];
  if (
    input.missingCheckins === 0 &&
    input.flagged === 0 &&
    queueLines.length === 0
  )
    return null;
  const lines: string[] = [];
  if (input.missingCheckins > 0)
    lines.push(
      `*Check-ins outstanding:* ${input.missingCheckins} of your team ${input.missingCheckins === 1 ? "has" : "have"} not submitted yet`,
    );
  if (input.flagged > 0)
    lines.push(
      `*Needs a look:* ${input.flagged} ${input.flagged === 1 ? "check-in" : "check-ins"} flagged a blocker or low mood this week`,
    );
  for (const line of queueLines) lines.push(`*Also waiting:* ${line}`);
  return {
    text: "Your team pulse for the week",
    blocks: [
      { type: "header", text: { type: "plain_text", text: "Team pulse" } },
      { type: "section", text: { type: "mrkdwn", text: lines.join("\n") } },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<${input.appUrl}/pulse/checkins?tab=team|Open team check-ins>`,
          },
        ],
      },
    ],
  };
}

export function buildManagerReviewQueue(input: {
  awaitingReview: number;
  appUrl: string;
}): SlackMessage | null {
  if (input.awaitingReview === 0) return null;
  const text = `${input.awaitingReview} ${input.awaitingReview === 1 ? "check-in is" : "check-ins are"} waiting for your review before the weekend.`;
  return {
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<${input.appUrl}/pulse/checkins?tab=team|Review in Kazi>`,
          },
        ],
      },
    ],
  };
}

export function buildOneOnOneReminder(input: {
  withName: string;
  time: string;
  appUrl: string;
}): SlackMessage {
  const text = `1-on-1 with ${input.withName} starts at ${input.time}.`;
  return {
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<${input.appUrl}/pulse/one-on-ones|Prepare in Kazi>`,
          },
        ],
      },
    ],
  };
}

export function buildOneOnOneFollowUp(input: {
  withName: string;
  appUrl: string;
  meetingId: string;
}): SlackMessage {
  const text = `Add notes and action items for your 1-on-1 with ${input.withName}.`;
  return {
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<${input.appUrl}/pulse/one-on-ones/${input.meetingId}|Update the 1-on-1>`,
          },
        ],
      },
    ],
  };
}

export function buildInterviewReminder(input: {
  candidateName: string;
  roleTitle: string;
  time: string;
  overdue?: boolean;
  appUrl: string;
}): SlackMessage {
  const text = input.overdue
    ? `Your scorecard for ${input.candidateName}'s ${input.roleTitle} interview is overdue.`
    : `Interview with ${input.candidateName} for ${input.roleTitle} starts at ${input.time}.`;
  return {
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<${input.appUrl}/hire/candidates|Open interviews in Kazi>`,
          },
        ],
      },
    ],
  };
}

export function buildHallOfFameClosingReminder(input: {
  daysRemaining: number;
  appUrl: string;
}): SlackMessage {
  const text = `Wall of Fame nominations close in ${input.daysRemaining} days. Take a moment to recognise impactful work at Growthpad.`;
  return {
    text,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "Wall of Fame nominations" },
      },
      { type: "section", text: { type: "mrkdwn", text } },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<${input.appUrl}/pulse/hall-of-fame|Open Wall of Fame in Kazi>`,
          },
        ],
      },
    ],
  };
}

/** A private guardrail for a timer that was probably left running. */
export function buildTimerRunningReminder(input: {
  task: string;
  elapsedHours: number;
  urgent: boolean;
  appUrl: string;
}): SlackMessage {
  const text = input.urgent
    ? `Your timer for ${input.task} has been running for about ${input.elapsedHours} hours. Stop it now so today's log stays accurate.`
    : `Your timer for ${input.task} has been running for about ${input.elapsedHours} hours. Still working on it?`;
  return {
    text,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: input.urgent ? "Timer still running" : "Timer check-in",
        },
      },
      { type: "section", text: { type: "mrkdwn", text } },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<${input.appUrl}/pulse/checkins?tab=daily|Open and stop timer in Kazi>`,
          },
        ],
      },
    ],
  };
}

/** Released review results waiting for the employee's acknowledgement. */
export function buildReviewAcknowledgementReminder(input: {
  outstanding: number;
  appUrl: string;
}): SlackMessage | null {
  if (input.outstanding === 0) return null;
  const text =
    input.outstanding === 1
      ? "Your review results are ready. Read them and add your response in Kazi."
      : `${input.outstanding} review results are ready. Read them and add your response in Kazi.`;
  return {
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<${input.appUrl}/pulse/reviews|Read your results>`,
          },
        ],
      },
    ],
  };
}
