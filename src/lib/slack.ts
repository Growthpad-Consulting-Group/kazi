import { supabaseAdmin } from "@/lib/supabase";

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
