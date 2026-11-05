import { NextResponse } from "next/server";
import { verifySlackSignature } from "@/lib/slack-signature";
import { resolveSlackLink } from "@/lib/slack-links";
import { loadHomeData } from "@/lib/slack-home";
import { buildHomeView, buildUnlinkedHomeView } from "@/lib/slack-home-view";

type SlackEventEnvelope = {
  type?: string;
  challenge?: string;
  event?: { type?: string; tab?: string; user?: string };
};

async function publishHomeView(slackUserId: string) {
  const link = await resolveSlackLink(slackUserId);
  const view = link
    ? buildHomeView(await loadHomeData(link.user_id))
    : buildUnlinkedHomeView();
  const response = await fetch("https://slack.com/api/views.publish", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN ?? ""}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ user_id: slackUserId, view }),
  });
  const result = (await response.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
  } | null;
  if (!result?.ok)
    console.error("Slack views.publish failed", result?.error ?? "unknown");
}

/** Slack Events API endpoint. Only the Home tab is handled; other events are acknowledged and ignored. */
export async function POST(request: Request) {
  const raw = await request.text();
  const valid = verifySlackSignature({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    timestamp: request.headers.get("x-slack-request-timestamp"),
    rawBody: raw,
    signature: request.headers.get("x-slack-signature"),
  });
  if (!valid)
    return NextResponse.json(
      { error: "Invalid Slack signature" },
      { status: 401 },
    );

  let body: SlackEventEnvelope | null = null;
  try {
    body = JSON.parse(raw) as SlackEventEnvelope;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // One-time endpoint check when the Request URL is saved in Slack.
  if (body?.type === "url_verification" && body.challenge)
    return NextResponse.json({ challenge: body.challenge });

  const event = body?.event;
  if (
    body?.type === "event_callback" &&
    event?.type === "app_home_opened" &&
    event.tab === "home" &&
    event.user
  ) {
    try {
      await publishHomeView(event.user);
    } catch (error) {
      // A failed refresh must not make Slack retry the event; the next open retries it.
      console.error("Home tab refresh failed", error);
    }
  }

  return new NextResponse(null, { status: 200 });
}
