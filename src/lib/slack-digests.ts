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
  appUrl: string;
}): SlackMessage | null {
  if (input.missingCheckins === 0 && input.flagged === 0) return null;
  const lines: string[] = [];
  if (input.missingCheckins > 0)
    lines.push(
      `*Check-ins outstanding:* ${input.missingCheckins} of your team ${input.missingCheckins === 1 ? "has" : "have"} not submitted yet`,
    );
  if (input.flagged > 0)
    lines.push(
      `*Needs a look:* ${input.flagged} ${input.flagged === 1 ? "check-in" : "check-ins"} flagged a blocker or low mood this week`,
    );
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
