import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";
import { verifySlackSignature } from "@/lib/slack-signature";
import { resolveSlackLink } from "@/lib/slack-links";
import { createRecognition } from "@/lib/recognition-create";
import { loadRecognitionOptions } from "@/lib/slack-recognition-modal";
import {
  RECOGNITION_CALLBACK_ID,
  buildRecognitionModal,
  readRecognitionSubmission,
} from "@/lib/slack-recognition-view";
import {
  SLACK_MESSAGE_TIMER_CALLBACK_ID,
  SLACK_TIMER_CALLBACK_ID,
  buildSlackTimerModal,
  readSlackTimerSubmission,
} from "@/lib/slack-timer-view";
import { localClock } from "@/lib/slack-schedule";
import type { SharedActiveTimer } from "@/features/pulse/daily-log/shared-timer";

const SNOOZE_HOURS = 4;
const SNOOZE_KINDS = ["review_acknowledgement", "checkin_review"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables
const db = supabaseAdmin as any;

function ephemeral(text: string) {
  return NextResponse.json({ response_type: "ephemeral", text });
}

/** Shortcut replies go to Slack's own response URL, and only to Slack's host. */
async function replyToResponseUrl(
  responseUrl: string | undefined,
  text: string,
) {
  if (!responseUrl || !responseUrl.startsWith("https://hooks.slack.com/"))
    return;
  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response_type: "ephemeral", text }),
  }).catch(() => undefined);
}

/**
 * Slack returns HTTP 200 even when `views.open` rejects a modal (for example,
 * when an app token or shortcut configuration is stale). Check its JSON body
 * so the person who invoked the shortcut is not left without feedback.
 */
async function openRecognitionModal(triggerId: string, responseUrl?: string) {
  try {
    const options = await loadRecognitionOptions();
    const response = await fetch("https://slack.com/api/views.open", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN ?? ""}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        trigger_id: triggerId,
        view: buildRecognitionModal(options),
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
    } | null;

    if (response.ok && body?.ok) return;

    console.error(
      "[Slack] recognise_teammate views.open failed:",
      body?.error ?? `HTTP ${response.status}`,
    );
  } catch (error) {
    console.error("[Slack] recognise_teammate views.open failed", error);
  }

  await replyToResponseUrl(
    responseUrl,
    "Could not open the recognition form. Please try again, or open Kazi and recognise your teammate there.",
  );
}

async function openSlackTimerModal(
  triggerId: string,
  initialTask: string,
  responseUrl?: string,
) {
  try {
    const response = await fetch("https://slack.com/api/views.open", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN ?? ""}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        trigger_id: triggerId,
        view: buildSlackTimerModal(initialTask),
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
    } | null;
    if (response.ok && body?.ok) return;
    console.error(
      "[Slack] start Kazi timer views.open failed:",
      body?.error ?? `HTTP ${response.status}`,
    );
  } catch (error) {
    console.error("[Slack] start Kazi timer views.open failed", error);
  }
  await replyToResponseUrl(
    responseUrl,
    "Could not open the timer form. Please try again, or start your timer in Kazi.",
  );
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
    trigger_id?: string;
    response_url?: string;
    user?: { id?: string };
    channel?: { id?: string; name?: string };
    actions?: { action_id?: string; value?: string }[];
    view?: { callback_id?: string; state?: unknown };
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
    if (payload.callback_id === RECOGNITION_CALLBACK_ID && payload.trigger_id) {
      // Opens the modal. Submission is handled below; the message is not read.
      await openRecognitionModal(payload.trigger_id, payload.response_url);
    }
    if (payload.callback_id === "open_kazi") {
      const appUrl = process.env.PRODUCTION_APP_URL ?? "http://localhost:3000";
      await replyToResponseUrl(
        payload.response_url,
        `Open Kazi: ${appUrl}/pulse`,
      );
    }
    if (
      payload.callback_id === SLACK_MESSAGE_TIMER_CALLBACK_ID &&
      payload.trigger_id
    ) {
      const channel = payload.channel?.name?.trim();
      await openSlackTimerModal(
        payload.trigger_id,
        channel ? `Slack: #${channel}` : "Slack conversation",
        payload.response_url,
      );
    }
    return new NextResponse(null, { status: 200 });
  }

  if (payload?.type === "shortcut") {
    if (!link) {
      await replyToResponseUrl(
        payload.response_url,
        "Your Slack account is not linked to Kazi.",
      );
      return new NextResponse(null, { status: 200 });
    }
    if (payload.callback_id === SLACK_TIMER_CALLBACK_ID && payload.trigger_id)
      await openSlackTimerModal(payload.trigger_id, "", payload.response_url);
    return new NextResponse(null, { status: 200 });
  }

  if (
    payload?.type === "view_submission" &&
    payload.view?.callback_id === RECOGNITION_CALLBACK_ID
  ) {
    return handleRecognitionSubmission(
      link?.user_id ?? null,
      payload as Parameters<typeof readRecognitionSubmission>[0],
    );
  }

  if (
    payload?.type === "view_submission" &&
    payload.view?.callback_id === SLACK_TIMER_CALLBACK_ID
  )
    return handleSlackTimerSubmission(
      link?.user_id ?? null,
      payload as Parameters<typeof readSlackTimerSubmission>[0],
    );

  if (!link) return ephemeral("Your Slack account is not linked to Kazi.");

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
    return ephemeral(
      "Acknowledged in Kazi. Add a response there if you want to.",
    );
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
    if (error)
      return ephemeral("Could not save the reminder. Try again later.");
    return ephemeral(`OK, I will remind you in ${SNOOZE_HOURS} hours.`);
  }

  return ephemeral("That action is not available.");
}

async function handleSlackTimerSubmission(
  userId: string | null,
  payload: Parameters<typeof readSlackTimerSubmission>[0],
) {
  if (!userId) return NextResponse.json({ response_action: "clear" });
  const submission = readSlackTimerSubmission(payload);
  if (!submission.task)
    return NextResponse.json({
      response_action: "errors",
      errors: { task: "Describe the activity before starting the timer." },
    });
  if (!submission.category)
    return NextResponse.json({
      response_action: "errors",
      errors: { category: "Choose a valid activity type." },
    });

  const { data: user } = await db
    .from("users")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();
  const now = new Date();
  const clock = localClock(now, user?.timezone ?? "Africa/Nairobi");
  const { data: active, error: activeError } = await db
    .from("shared_active_timers")
    .select("timer")
    .eq("user_id", userId)
    .maybeSingle();
  if (activeError)
    return NextResponse.json({
      response_action: "errors",
      errors: { task: "Could not check your active timer. Try again." },
    });
  if (active?.timer)
    return NextResponse.json({
      response_action: "errors",
      errors: { task: "Stop your active Kazi timer before starting another." },
    });

  const timer: SharedActiveTimer = {
    id: crypto.randomUUID(),
    logDate: clock.date,
    task: submission.task,
    client: null,
    category: submission.category,
    startedAt: now.toISOString(),
    accumulatedMs: 0,
    running: true,
    source: "kazi",
    updatedAt: now.toISOString(),
  };
  const { error } = await db.from("shared_active_timers").insert({
    user_id: userId,
    timer_id: timer.id,
    log_date: timer.logDate,
    timer,
    updated_at: timer.updatedAt,
  });
  if (error)
    return NextResponse.json({
      response_action: "errors",
      errors: { task: "Could not start the timer. Try again." },
    });
  return NextResponse.json({ response_action: "clear" });
}

/**
 * Creates public recognition from the Slack modal through the same shared rules
 * as the web form. Errors are shown inside the modal next to the field that needs fixing.
 */
async function handleRecognitionSubmission(
  senderUserId: string | null,
  payload: Parameters<typeof readRecognitionSubmission>[0],
) {
  if (!senderUserId) return NextResponse.json({ response_action: "clear" });
  const submission = readRecognitionSubmission(payload);
  if (!submission.recipientSlackId)
    return NextResponse.json({
      response_action: "errors",
      errors: { recipient: "Choose a colleague." },
    });
  if (!submission.message)
    return NextResponse.json({
      response_action: "errors",
      errors: { message: "Add a message." },
    });

  const recipient = await resolveSlackLink(submission.recipientSlackId);
  if (!recipient)
    return NextResponse.json({
      response_action: "errors",
      errors: { recipient: "That colleague is not linked to Kazi yet." },
    });

  const { data: sender } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", senderUserId)
    .maybeSingle();
  const result = await createRecognition({
    fromUserId: senderUserId,
    senderName: (sender?.name as string | undefined) ?? "A colleague",
    recipientIds: [recipient.user_id],
    message: submission.message,
    visibility: "public",
    valueId: submission.valueId,
    campaignId: submission.campaignId,
  });
  if (!result.ok)
    return NextResponse.json({
      response_action: "errors",
      errors: { message: result.error },
    });
  return NextResponse.json({ response_action: "clear" });
}
