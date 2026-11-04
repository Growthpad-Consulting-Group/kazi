import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { deliverSlackNotification } from "@/lib/slack";

const DEFAULT_MESSAGE = "You were mentioned in shared 1-on-1 notes.";

function hasMention(text: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)@${escaped}(?=$|[\\s,.;:!?])`, "i").test(text);
}

/**
 * Records only authorised @mentions. The notification never contains the
 * source text, preventing an alert from becoming a side channel for notes.
 * Only active staff in `allowedRecipientIds` can be notified, and the author
 * is never notified of their own mention.
 */
export async function notifyPulseMentions({
  sourceType,
  sourceId,
  text,
  actorId,
  allowedRecipientIds,
  link,
  message = DEFAULT_MESSAGE,
}: {
  sourceType: string;
  sourceId: string;
  text: string;
  actorId: string;
  allowedRecipientIds: string[];
  link: string;
  /** Generic wording for the alert. It must never quote the source text. */
  message?: string;
}) {
  const clean = text.trim();
  const recipientIds = [...new Set(allowedRecipientIds)].filter(
    (id) => id !== actorId,
  );
  if (!clean || !recipientIds.length) return;
  const { data: people } = await supabaseAdmin
    .from("users")
    .select("id,name")
    .in("id", recipientIds)
    .eq("is_active", true);
  const mentioned = (people ?? []).filter((person) =>
    hasMention(clean, person.name),
  );
  if (!mentioned.length) return;

  const bodyHash = createHash("sha256").update(clean).digest("hex");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table awaits generated types
  const { data } = await (supabaseAdmin as any)
    .from("pulse_mentions")
    .upsert(
      mentioned.map((person) => ({
        source_type: sourceType,
        source_id: sourceId,
        recipient_user_id: person.id,
        mentioned_by: actorId,
        body_hash: bodyHash,
      })),
      {
        onConflict: "source_type,source_id,recipient_user_id,body_hash",
        ignoreDuplicates: true,
      },
    )
    .select("recipient_user_id");
  const createdRecipientIds: string[] = (data ?? []).map(
    (row: { recipient_user_id: string }) => row.recipient_user_id,
  );
  if (!createdRecipientIds.length) return;
  await Promise.all([
    supabaseAdmin.from("notifications").insert(
      createdRecipientIds.map((userId) => ({
        user_id: userId,
        message,
        link,
      })),
    ),
    ...createdRecipientIds.map((recipientUserId) =>
      deliverSlackNotification({
        eventKey: `pulse-mention:${sourceType}:${sourceId}:${bodyHash}:${recipientUserId}`,
        recipientUserId,
        category: "mention",
        text: message,
      }),
    ),
  ]);
}

/** Goal descriptions: the owner and the owner's manager can be mentioned. */
export async function notifyGoalMentions({
  goalId,
  ownerId,
  text,
  actorId,
}: {
  goalId: string;
  ownerId: string;
  text: string;
  actorId: string;
}) {
  const { data: owner } = await supabaseAdmin
    .from("users")
    .select("manager_id")
    .eq("id", ownerId)
    .maybeSingle();
  await notifyPulseMentions({
    sourceType: "goal_description",
    sourceId: goalId,
    text,
    actorId,
    allowedRecipientIds: [ownerId, owner?.manager_id].filter(
      (id): id is string => Boolean(id),
    ),
    link: "/pulse/goals",
    message: "You were mentioned in a goal.",
  });
}

/** Public recognition: any active staff member can be mentioned, as the message is public. */
export async function notifyFeedbackMentions({
  feedbackId,
  text,
  actorId,
}: {
  feedbackId: string;
  text: string;
  actorId: string;
}) {
  const { data: staff } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("is_active", true);
  await notifyPulseMentions({
    sourceType: "feedback_message",
    sourceId: feedbackId,
    text,
    actorId,
    allowedRecipientIds: (staff ?? []).map((row) => row.id),
    link: "/pulse/feedback",
    message: "You were mentioned in a recognition message.",
  });
}

/** Review comments: only the two participants of the review can be mentioned. */
export async function notifyReviewMentions({
  reviewId,
  text,
  actorId,
  reviewerId,
  revieweeId,
}: {
  reviewId: string;
  text: string;
  actorId: string;
  reviewerId: string;
  revieweeId: string;
}) {
  await notifyPulseMentions({
    sourceType: "review_text",
    sourceId: reviewId,
    text,
    actorId,
    allowedRecipientIds: [reviewerId, revieweeId],
    link: "/pulse/reviews",
    message: "You were mentioned in a performance review.",
  });
}
