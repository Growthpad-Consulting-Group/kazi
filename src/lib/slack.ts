import { supabaseAdmin } from "@/lib/supabase";
import { isInQuietHours } from "@/lib/slack-schedule";
import { isOverLimit, RATE_LIMIT_PER_MINUTE } from "@/lib/slack-admin";
import { buildCheckinSubmissionConfirmation } from "@/lib/slack-digests";

type SlackBlocks = object[];
type SlackPreference = {
  slack_enabled: boolean;
  slack_delivery: "instant" | "digest";
  slack_quiet_start: string | null;
  slack_quiet_end: string | null;
  slack_timezone: string | null;
  [key: string]: boolean | string | null;
};

const CATEGORY_PREFERENCE: Record<string, string> = {
  checkin_submitted: "checkin_submitted",
  checkin_reminder: "checkin_reminders",
  one_on_one_scheduled: "one_on_one_scheduled",
  one_on_one_reminder: "one_on_one_reminder",
  survey_published: "survey_published",
  campaign_update: "campaign_updates",
  side_quest_update: "side_quest_updates",
  goal_completed: "goal_completed",
  goal_due_soon: "goal_due_soon",
  review_open: "review_cycle_started",
  review_reminder: "review_cycle_started",
  daily_brief: "slack_daily_brief",
};

/** Categories that are sent only when the recipient has explicitly opted in. */
const OPT_IN_CATEGORIES = new Set(["daily_brief"]);

export type SlackDeliveryInput = {
  eventKey: string;
  recipientUserId: string;
  category: string;
  text: string;
  blocks?: SlackBlocks;
  /** Required manager/HR action can bypass a voluntary quiet-hours preference. */
  critical?: boolean;
  /**
   * Set by scheduled digest workers, which already batch content. Digest-mode
   * recipients still receive these, while instant-only messages are held back.
   */
  digest?: boolean;
};

async function recordSlackDelivery(
  eventKey: string,
  patch: Record<string, unknown>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table awaits generated types
  await (supabaseAdmin as any)
    .from("slack_notification_deliveries")
    .update(patch)
    .eq("event_key", eventKey);
}

async function configuredCompanyWebhook(): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from("slack_connections")
      .select("webhook_url")
      .limit(1)
      .maybeSingle();
    return data?.webhook_url ?? process.env.SLACK_WEBHOOK_URL ?? null;
  } catch {
    return process.env.SLACK_WEBHOOK_URL ?? null;
  }
}

/**
 * Posts an approved culture update to the configured company channel once.
 * It uses the same delivery ledger as DMs, but stores no recipient or content.
 */
export async function postSlackChannelNotification({
  eventKey,
  category,
  text,
  blocks,
}: Omit<SlackDeliveryInput, "recipientUserId" | "critical">): Promise<
  "delivered" | "suppressed" | "failed"
> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table awaits generated types
  const db = supabaseAdmin as any;
  const { error: reservationError } = await db
    .from("slack_notification_deliveries")
    .insert({ event_key: eventKey, category, status: "pending" });
  if (reservationError) return "suppressed";

  const webhookUrl = await configuredCompanyWebhook();
  if (!webhookUrl) {
    await recordSlackDelivery(eventKey, {
      status: "suppressed",
      error: "No company Slack webhook configured",
    });
    return "suppressed";
  }
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, ...(blocks ? { blocks } : {}) }),
    });
    if (!response.ok) {
      await recordSlackDelivery(eventKey, {
        status: "failed",
        error: `Slack webhook returned ${response.status}`,
      });
      return "failed";
    }
    await recordSlackDelivery(eventKey, {
      status: "delivered",
      destination: "company-channel",
      delivered_at: new Date().toISOString(),
    });
    return "delivered";
  } catch (error) {
    await recordSlackDelivery(eventKey, {
      status: "failed",
      error:
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Unknown Slack webhook error",
    });
    return "failed";
  }
}

/**
 * Delivers one private Slack message at most once. The delivery row is reserved
 * before calling Slack, so retries and concurrent requests cannot duplicate it.
 */
export async function deliverSlackNotification({
  eventKey,
  recipientUserId,
  category,
  text,
  blocks,
  critical = false,
  digest = false,
}: SlackDeliveryInput): Promise<"delivered" | "suppressed" | "failed"> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return "suppressed";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables await generated types
  const db = supabaseAdmin as any;
  const { data: recipient } = await supabaseAdmin
    .from("users")
    .select("id,email,is_active")
    .eq("id", recipientUserId)
    .maybeSingle();
  if (!recipient?.is_active || !recipient.email) return "suppressed";

  const { data: preferenceRow, error: preferenceError } = await db
    .from("user_notification_preferences")
    .select(
      "slack_enabled,slack_delivery,slack_quiet_start,slack_quiet_end,slack_timezone,slack_daily_brief,checkin_submitted,checkin_reminders,one_on_one_scheduled,one_on_one_reminder,survey_published,campaign_updates,side_quest_updates,goal_completed,goal_due_soon",
    )
    .eq("user_id", recipientUserId)
    .maybeSingle();
  // If preferences cannot be read, the recipient's opt-outs are unknown. Hold the
  // message rather than fall back to defaults that ignore those opt-outs.
  if (preferenceError) return "suppressed";

  const preferences: SlackPreference = {
    slack_enabled: preferenceRow?.slack_enabled ?? true,
    slack_delivery: preferenceRow?.slack_delivery ?? "instant",
    slack_quiet_start: preferenceRow?.slack_quiet_start ?? null,
    slack_quiet_end: preferenceRow?.slack_quiet_end ?? null,
    slack_timezone: preferenceRow?.slack_timezone ?? "Africa/Nairobi",
  };

  // An administrator can switch a whole category off. A workspace-wide rate guard
  // holds back bursts. Rate-limited messages are skipped without a record, so a
  // later run can still send them.
  const { data: control } = await db
    .from("slack_category_controls")
    .select("enabled")
    .eq("category", category)
    .maybeSingle();
  const categoryDisabled = control?.enabled === false;
  if (!categoryDisabled) {
    const { count } = await db
      .from("slack_notification_deliveries")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 60_000).toISOString());
    if (isOverLimit(count ?? 0, RATE_LIMIT_PER_MINUTE)) return "suppressed";
  }

  const optInColumn = CATEGORY_PREFERENCE[category];
  const suppressReason = categoryDisabled
    ? "Turned off for all staff by an administrator"
    : !preferences.slack_enabled
      ? "Slack notifications disabled by recipient"
      : OPT_IN_CATEGORIES.has(category) && preferenceRow?.[optInColumn] !== true
        ? "Recipient has not opted in to this message"
        : optInColumn &&
            !OPT_IN_CATEGORIES.has(category) &&
            preferenceRow?.[optInColumn] === false
          ? "Recipient disabled this notification category"
          : !critical && !digest && preferences.slack_delivery === "digest"
            ? "Recipient chose digest delivery"
            : !critical &&
                isInQuietHours(
                  preferences.slack_quiet_start,
                  preferences.slack_quiet_end,
                  preferences.slack_timezone,
                  new Date(),
                )
              ? "Deferred for recipient quiet hours"
              : null;

  const { error: reservationError } = await db
    .from("slack_notification_deliveries")
    .insert({
      event_key: eventKey,
      recipient_user_id: recipientUserId,
      category,
      status: "pending",
    });
  if (reservationError) return "suppressed";

  if (suppressReason) {
    await recordSlackDelivery(eventKey, {
      status: "suppressed",
      error: suppressReason,
    });
    return "suppressed";
  }

  try {
    const { data: cachedLink } = await db
      .from("slack_member_links")
      .select("slack_member_id")
      .eq("user_id", recipientUserId)
      .maybeSingle();
    let memberId = cachedLink?.slack_member_id as string | undefined;
    if (!memberId) {
      const lookup = await fetch(
        `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(recipient.email)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const lookupJson = (await lookup.json()) as {
        ok: boolean;
        user?: { id: string };
        error?: string;
      };
      if (!lookupJson.ok || !lookupJson.user?.id) {
        await recordSlackDelivery(eventKey, {
          status: "failed",
          error: lookupJson.error ?? "Slack member not found",
        });
        return "failed";
      }
      memberId = lookupJson.user.id;
      await db
        .from("slack_member_links")
        .upsert(
          { user_id: recipientUserId, slack_member_id: memberId },
          { onConflict: "user_id" },
        );
    }
    const post = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: memberId,
        text,
        ...(blocks ? { blocks } : {}),
      }),
    });
    const postJson = (await post.json()) as {
      ok: boolean;
      ts?: string;
      error?: string;
    };
    if (!postJson.ok) {
      await recordSlackDelivery(eventKey, {
        status: "failed",
        error: postJson.error ?? "Slack rejected the message",
      });
      return "failed";
    }
    await recordSlackDelivery(eventKey, {
      status: "delivered",
      destination: memberId,
      slack_timestamp: postJson.ts ?? null,
      delivered_at: new Date().toISOString(),
    });
    return "delivered";
  } catch (error) {
    await recordSlackDelivery(eventKey, {
      status: "failed",
      error:
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Unknown Slack error",
    });
    return "failed";
  }
}

/** Send the submitter a private, content-free receipt for their weekly check-in. */
export async function deliverCheckinSubmissionConfirmation(input: {
  userId: string;
  weekStart: string;
}) {
  const appUrl = process.env.PRODUCTION_APP_URL ?? "http://localhost:3000";
  const message = buildCheckinSubmissionConfirmation({
    appUrl,
    weekStart: input.weekStart,
  });
  return deliverSlackNotification({
    eventKey: `checkin-submitted:${input.userId}:${input.weekStart}:submitter`,
    recipientUserId: input.userId,
    category: "checkin_confirmation",
    // A receipt is immediate and should not be held for a digest or quiet hours.
    critical: true,
    ...message,
  });
}

/**
 * One-time safe replay for prior weekly submissions. The delivery ledger keeps
 * this idempotent, so it can be rerun without sending duplicate DMs.
 */
export async function backfillCheckinSubmissionConfirmations() {
  const { data, error } = await supabaseAdmin
    .from("checkins")
    .select("user_id, week_start")
    .in("status", ["submitted", "reviewed"]);
  if (error) throw new Error(error.message);

  const counts = { delivered: 0, suppressed: 0, failed: 0 };
  for (const checkin of data ?? []) {
    const outcome = await deliverCheckinSubmissionConfirmation({
      userId: checkin.user_id,
      weekStart: checkin.week_start,
    });
    counts[outcome] += 1;
  }
  return { attempted: (data ?? []).length, ...counts };
}

/**
 * Direct-message a workspace member by email using the Slack bot token.
 * Returns false when the token is missing, the person isn't found, or Slack rejects the message.
 */
export async function sendSlackDirectMessage(
  email: string,
  text: string,
  blocks?: object[],
): Promise<boolean> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token || !email) return false;

  try {
    const lookup = await fetch(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const lookupJson = (await lookup.json()) as {
      ok: boolean;
      user?: { id: string };
      error?: string;
    };
    if (!lookupJson.ok || !lookupJson.user?.id) return false;

    const post = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: lookupJson.user.id,
        text,
        ...(blocks ? { blocks } : {}),
      }),
    });
    const postJson = (await post.json()) as { ok: boolean; error?: string };
    if (!postJson.ok)
      console.error("[Slack] chat.postMessage failed:", postJson.error);
    return postJson.ok;
  } catch (e) {
    console.error("[Slack] sendSlackDirectMessage failed:", e);
    return false;
  }
}

export async function sendOneOnOneSlackDMs(
  managerId: string,
  reportId: string,
  scheduledAt: string,
): Promise<void> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, name, email")
    .in("id", [managerId, reportId]);
  const people = (data ?? []) as { id: string; name: string; email: string }[];
  const manager = people.find((u) => u.id === managerId);
  const report = people.find((u) => u.id === reportId);
  if (!manager || !report) return;

  const formattedDate = new Date(scheduledAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  const appUrl = process.env.PRODUCTION_APP_URL ?? "http://localhost:3000";
  const dmBlocks = (withName: string) => [
    {
      type: "header",
      text: { type: "plain_text", text: "📅 1-on-1 Scheduled" },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `You have a 1-on-1 with *${withName}* scheduled for ${formattedDate}.`,
      },
    },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: `<${appUrl}/pulse/one-on-ones|View 1-on-1s>` },
      ],
    },
  ];

  await Promise.all([
    deliverSlackNotification({
      eventKey: `one-on-one-scheduled:${managerId}:${reportId}:${scheduledAt}:manager`,
      recipientUserId: manager.id,
      category: "one_on_one_scheduled",
      text: `1-on-1 with ${report.name} scheduled for ${formattedDate}`,
      blocks: dmBlocks(report.name),
    }),
    deliverSlackNotification({
      eventKey: `one-on-one-scheduled:${managerId}:${reportId}:${scheduledAt}:report`,
      recipientUserId: report.id,
      category: "one_on_one_scheduled",
      text: `1-on-1 with ${manager.name} scheduled for ${formattedDate}`,
      blocks: dmBlocks(manager.name),
    }),
  ]);
}

/**
 * Post a message to the configured Slack webhook.
 * Falls back to SLACK_WEBHOOK_URL env var if no DB row exists.
 * Silently no-ops if neither is configured.
 */
export async function postSlackMessage(
  text: string,
  blocks?: object[],
): Promise<void> {
  const webhookUrl = await configuredCompanyWebhook();

  if (!webhookUrl) return; // no-op

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, ...(blocks ? { blocks } : {}) }),
    });
  } catch (e) {
    console.error("[Slack] postSlackMessage failed:", e);
  }
}
