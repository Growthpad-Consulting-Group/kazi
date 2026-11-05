// Pure view builder for the Slack Home tab. No database imports, so it can be tested directly.

export type HomeData = {
  firstName: string;
  meetingsNext24h: number;
  logged: boolean;
  checkinSubmitted: boolean;
  goalsOpen: number;
  goalsDueSoon: number;
  timerRunning: boolean;
  // Only set for people with direct reports. Counts only, never names.
  checkinsAwaitingReview: number | null;
};

function appUrl() {
  return process.env.PRODUCTION_APP_URL ?? "http://localhost:3000";
}

type Block = Record<string, unknown>;

function linkButton(text: string, url: string, style?: "primary"): Block {
  return {
    type: "button",
    text: { type: "plain_text", text },
    url,
    ...(style ? { style } : {}),
  };
}

/** Builds the Home tab view. Counts and links only; no task titles, notes or manager-only detail. */
export function buildHomeView(data: HomeData): Record<string, unknown> {
  const base = appUrl();
  const blocks: Block[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `Hi ${data.firstName}`, emoji: true },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*1-on-1s, next 24 hours*\n${data.meetingsNext24h}`,
        },
        {
          type: "mrkdwn",
          text: `*Daily log*\n${data.logged ? "Logged today" : "Not logged yet"}`,
        },
        {
          type: "mrkdwn",
          text: `*Weekly check-in*\n${data.checkinSubmitted ? "Submitted" : "Still to submit"}`,
        },
        {
          type: "mrkdwn",
          text: `*Open goals*\n${data.goalsOpen}${data.goalsDueSoon ? ` · ${data.goalsDueSoon} due within a week` : ""}`,
        },
        {
          type: "mrkdwn",
          text: `*Timer*\n${data.timerRunning ? "Running. Stop it before your daily log." : "Not running"}`,
        },
      ],
    },
    {
      type: "actions",
      elements: [
        linkButton("Open today in Kazi", `${base}/pulse`, "primary"),
        linkButton("Weekly check-in", `${base}/pulse/checkins`),
        linkButton("Goals", `${base}/pulse/goals`),
      ],
    },
  ];

  if (data.checkinsAwaitingReview !== null) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          data.checkinsAwaitingReview === 0
            ? "*Your team*\nNo check-ins are waiting for review."
            : `*Your team*\n${data.checkinsAwaitingReview} ${data.checkinsAwaitingReview === 1 ? "check-in is" : "check-ins are"} waiting for review.`,
      },
      ...(data.checkinsAwaitingReview > 0
        ? {
            accessory: linkButton("Review queue", `${base}/pulse/checkins`),
          }
        : {}),
    });
  }

  blocks.push({ type: "divider" });
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "Only you can see this. Counts only; open Kazi for details.",
      },
    ],
  });

  return { type: "home", blocks };
}

/** Shown when the Slack account has no Kazi match. It names no internal details. */
export function buildUnlinkedHomeView(): Record<string, unknown> {
  return {
    type: "home",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Your Slack account is not linked to Kazi yet. Use the work email on your Kazi account in Slack, or ask your administrator.",
        },
      },
    ],
  };
}
