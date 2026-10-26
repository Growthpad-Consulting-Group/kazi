import { supabaseAdmin } from "@/lib/supabase";

/**
 * Direct-message a workspace member by email using the Slack bot token.
 * Returns false when the token is missing, the person isn't found, or Slack rejects the message.
 */
export async function sendSlackDirectMessage(email: string, text: string, blocks?: object[]): Promise<boolean> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token || !email) return false;

  try {
    const lookup = await fetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const lookupJson = await lookup.json() as { ok: boolean; user?: { id: string }; error?: string };
    if (!lookupJson.ok || !lookupJson.user?.id) return false;

    const post = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ channel: lookupJson.user.id, text, ...(blocks ? { blocks } : {}) }),
    });
    const postJson = await post.json() as { ok: boolean; error?: string };
    if (!postJson.ok) console.error("[Slack] chat.postMessage failed:", postJson.error);
    return postJson.ok;
  } catch (e) {
    console.error("[Slack] sendSlackDirectMessage failed:", e);
    return false;
  }
}

export async function sendOneOnOneSlackDMs(managerId: string, reportId: string, scheduledAt: string): Promise<void> {
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
    { type: "header", text: { type: "plain_text", text: "📅 1-on-1 Scheduled" } },
    { type: "section", text: { type: "mrkdwn", text: `You have a 1-on-1 with *${withName}* scheduled for ${formattedDate}.` } },
    { type: "context", elements: [{ type: "mrkdwn", text: `<${appUrl}/pulse/one-on-ones|View 1-on-1s>` }] },
  ];

  await Promise.all([
    sendSlackDirectMessage(manager.email, `1-on-1 with ${report.name} scheduled for ${formattedDate}`, dmBlocks(report.name)),
    sendSlackDirectMessage(report.email, `1-on-1 with ${manager.name} scheduled for ${formattedDate}`, dmBlocks(manager.name)),
  ]);
}

/**
 * Post a message to the configured Slack webhook.
 * Falls back to SLACK_WEBHOOK_URL env var if no DB row exists.
 * Silently no-ops if neither is configured.
 */
export async function postSlackMessage(text: string, blocks?: object[]): Promise<void> {
  let webhookUrl: string | null = null;

  try {
    const { data } = await supabaseAdmin
      .from("slack_connections")
      .select("webhook_url")
      .limit(1)
      .maybeSingle();
    webhookUrl = data?.webhook_url ?? null;
  } catch {
    // DB error — fall through to env var
  }

  if (!webhookUrl) {
    webhookUrl = process.env.SLACK_WEBHOOK_URL ?? null;
  }

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
