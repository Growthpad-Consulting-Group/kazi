import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase";

export type PushPayload = {
  title: string;
  body: string;
  /** Internal app path to open when the notification is clicked. */
  url?: string | null;
};

let configured = false;

function configureVapid(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

/** Only same-origin app paths may be opened from a push notification. */
function safeAppPath(url: string | null | undefined): string {
  if (!url || !url.startsWith("/") || url.startsWith("//")) return "/";
  return url;
}

/**
 * Sends a browser push to every subscribed device of the given users.
 * Never throws: a failed push must not roll back the action that caused it.
 * Devices the push service reports as gone (404/410) are removed.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<void> {
  if (!userIds.length || !configureVapid()) return;
  try {
    const { data: subscriptions, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", [...new Set(userIds)]);
    if (error || !subscriptions?.length) return;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: safeAppPath(payload.url),
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60 * 24 },
        ),
      ),
    );

    const goneIds = subscriptions
      .filter((_, index) => {
        const result = results[index];
        if (result.status !== "rejected") return false;
        const statusCode = (result.reason as { statusCode?: number })
          ?.statusCode;
        return statusCode === 404 || statusCode === 410;
      })
      .map((sub) => sub.id);
    if (goneIds.length) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", goneIds);
    }
  } catch (error) {
    console.error(
      "Could not send browser push",
      error instanceof Error ? error.message : error,
    );
  }
}
