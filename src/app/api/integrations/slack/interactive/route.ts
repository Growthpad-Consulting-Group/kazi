import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";
import { verifySlackSignature } from "@/lib/slack-signature";
import { resolveSlackLink } from "@/lib/slack-links";

const SNOOZE_HOURS = 4;
const SNOOZE_KINDS = ["review_acknowledgement", "checkin_review"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables
const db = supabaseAdmin as any;

function ephemeral(text: string) {
  return NextResponse.json({ response_type: "ephemeral", text });
}

/** Shortcut replies go to Slack's own response URL, and only to Slack's host. */
async function replyToResponseUrl(responseUrl: string | undefined, text: string) {
  if (!responseUrl || !responseUrl.startsWith("https://hooks.slack.com/")) return;
  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response_type: "ephemeral", text }),
  }).catch(() => undefined);
}

async function canReviewCheckin(actorId: string, employeeId: string) {
  const [{ data: actor }, { data: employee }] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("id", actorId)
      .maybeSingle(),
    supabaseAdmin
      .from("users")
      .select("manager_id")
      .eq("id", employeeId)
      .maybeSingle(),
  ]);
  if (!actor) return false;
  return employee?.manager_id === actorId || can(actor.role, "manage_checkins");
}

// Handles Slack button clicks and message shortcuts. Every change is attributed
// to the clicking person and checked against Kazi permissions first.
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

  const payload = JSON.parse(
    new URLSearchParams(raw).get("payload") ?? "null",
  ) as {
    type?: string;
    callback_id?: string;
    response_url?: string;
    user?: { id?: string };
    actions?: { action_id?: string; value?: string }[];
  } | null;
  const action = payload?.actions?.[0];
  const slackUserId = payload?.user?.id ?? "";

  const link = await resolveSlackLink(slackUserId);

  // Global "Open Kazi" message shortcut. It returns a private link only and never
  // reads or stores the message it was used on.
  if (payload?.type === "message_action") {
    if (!link) {
      await replyToResponseUrl(
        payload.response_url,
        "Your Slack account is not linked to Kazi.",
      );
      return new NextResponse(null, { status: 200 });
    }
    if (payload.callback_id === "open_kazi") {
      const appUrl = process.env.PRODUCTION_APP_URL ?? "http://localhost:3000";
      await replyToResponseUrl(payload.response_url, `Open Kazi: ${appUrl}/pulse`);
    }
    return new NextResponse(null, { status: 200 });
  }

  if (!link)
    return ephemeral("Your Slack account is not linked to Kazi.");

  if (action?.action_id === "mark_checkin_reviewed" && action.value) {
    const [employeeId, weekStart] = action.value.split("|");
    if (!employeeId || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart ?? ""))
      return ephemeral("That action is no longer valid.");
    if (!(await canReviewCheckin(link.user_id, employeeId)))
      return ephemeral("You cannot review this check-in.");

    const { data: updated, error } = await supabaseAdmin
      .from("checkins")
      .update({ status: "reviewed" })
      .eq("user_id", employeeId)
      .eq("week_start", weekStart)
      .eq("status", "submitted")
      .select("id");
    if (error) return ephemeral("Could not mark it reviewed. Try in Kazi.");
    return ephemeral(
      updated?.length
        ? "Marked as reviewed in Kazi."
        : "This check-in was already reviewed or changed.",
    );
  }

  if (action?.action_id === "acknowledge_review" && action.value) {
    // Same rules as the in-app acknowledgement route: only the reviewee, only once
    // results are released, and always audited.
    const reviewId = action.value;
    const { data: review } = await db
      .from("performance_reviews")
      .select("id, cycle_id, reviewee_id, employee_acknowledged_at")
      .eq("id", reviewId)
      .maybeSingle();
    if (!review || review.reviewee_id !== link.user_id)
      return ephemeral("You cannot acknowledge this review.");
    if (review.employee_acknowledged_at)
      return ephemeral("You have already acknowledged this review.");

    const { data: cycle } = await db
      .from("review_cycles")
      .select("results_released_at")
      .eq("id", review.cycle_id)
      .maybeSingle();
    if (!cycle?.results_released_at)
      return ephemeral("Final feedback has not been released yet.");

    const acknowledgedAt = new Date().toISOString();
    const { data: updated, error } = await db
      .from("performance_reviews")
      .update({ employee_acknowledged_at: acknowledgedAt })
      .eq("id", reviewId)
      .is("employee_acknowledged_at", null)
      .select("id");
    if (error || !updated?.length)
      return ephemeral("Could not acknowledge it. Try in Kazi.");
    await db.from("performance_review_audit_logs").insert({
      cycle_id: review.cycle_id,
      review_id: reviewId,
      actor_id: link.user_id,
      action: "employee_acknowledged",
    });
    return ephemeral("Acknowledged in Kazi. Add a response there if you want to.");
  }

  if (action?.action_id === "snooze_reminder" && action.value) {
    // Value format: `kind|target`. Target is a review id or `open` for reviews,
    // and `employeeId|weekStart` for check-ins.
    const [kind, ...rest] = action.value.split("|");
    const target = rest.join("|");
    if (!(SNOOZE_KINDS as readonly string[]).includes(kind) || !target)
      return ephemeral("That action is no longer valid.");

    if (kind === "checkin_review") {
      const [employeeId, weekStart] = target.split("|");
      if (
        !employeeId ||
        !/^\d{4}-\d{2}-\d{2}$/.test(weekStart ?? "") ||
        !(await canReviewCheckin(link.user_id, employeeId))
      )
        return ephemeral("You cannot snooze this check-in.");
    }

    const remindAfter = new Date(
      Date.now() + SNOOZE_HOURS * 3_600_000,
    ).toISOString();
    const { error } = await db.from("slack_reminder_snoozes").upsert(
      {
        user_id: link.user_id,
        kind,
        target_id: target,
        remind_after: remindAfter,
        sent_at: null,
      },
      { onConflict: "user_id,kind,target_id" },
    );
    if (error) return ephemeral("Could not save the reminder. Try again later.");
    return ephemeral(`OK, I will remind you in ${SNOOZE_HOURS} hours.`);
  }

  return ephemeral("That action is not available.");
}
