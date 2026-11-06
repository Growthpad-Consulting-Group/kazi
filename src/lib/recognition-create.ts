import { supabaseAdmin } from "@/lib/supabase";
import { notifyFeedbackMentions } from "@/lib/pulse-mentions";
import {
  invalidatePublicFeedback,
  invalidateUserPrivateFeedback,
} from "@/lib/cache/invalidate";
import { runAutomationEvent } from "@/lib/automations";
import { notifyRecognitionReceived } from "@/lib/notifications";
import {
  buildPublicRecognitionMessage,
  buildRecognitionReceivedMessage,
} from "@/lib/slack-digests";
import {
  deliverSlackNotification,
  postSlackChannelNotification,
} from "@/lib/slack";
import type { FeedbackVisibility } from "@/types/database";

export type RecognitionInput = {
  fromUserId: string;
  senderName: string;
  recipientIds: string[];
  message: string;
  visibility: FeedbackVisibility;
  emoji?: string | null;
  valueId?: string | null;
  campaignId?: string | null;
  mediaUrl?: string | null;
};

export type RecognitionResult =
  | { ok: true; feedbackId: string }
  | { ok: false; status: number; error: string };

/**
 * Creates recognition with the same rules for the web form and the Slack modal:
 * active recipients, active values, live campaigns, one recipient for private
 * feedback, mention alerts, the public wall, Slack messages, points and automations.
 * The caller must already have checked that the sender is the signed-in person.
 */
export async function createRecognition(
  input: RecognitionInput,
): Promise<RecognitionResult> {
  const recipientIds = [...new Set(input.recipientIds)];
  const message = input.message.trim();
  const visibility = input.visibility;

  if (!recipientIds.length || !message)
    return {
      ok: false,
      status: 400,
      error: "Choose at least one recipient and add a message.",
    };
  if (recipientIds.includes(input.fromUserId))
    return {
      ok: false,
      status: 400,
      error: "You cannot send feedback to yourself.",
    };
  if (visibility !== "public" && recipientIds.length > 1)
    return {
      ok: false,
      status: 400,
      error: "Private feedback can only have one recipient.",
    };

  const { data: recipients } = await supabaseAdmin
    .from("users")
    .select("id,name")
    .in("id", recipientIds)
    .eq("is_active", true);
  if ((recipients?.length ?? 0) !== recipientIds.length)
    return {
      ok: false,
      status: 400,
      error: "One or more recipients are unavailable.",
    };

  let recognitionValues: { id: string; name: string }[] = [];
  if (visibility === "public") {
    const { data: values } = await supabaseAdmin
      .from("recognition_values")
      .select("id,name")
      .eq("is_active", true);
    recognitionValues = values ?? [];
    if ((values?.length ?? 0) > 0 && !input.valueId)
      return {
        ok: false,
        status: 400,
        error: "Choose the value this recognition represents.",
      };
    if (input.valueId && !values?.some((value) => value.id === input.valueId))
      return {
        ok: false,
        status: 400,
        error: "Choose an active recognition value.",
      };
    if (input.campaignId) {
      const { data: campaign } = await supabaseAdmin
        .from("recognition_campaigns")
        .select("id")
        .eq("id", input.campaignId)
        .eq("status", "live")
        .maybeSingle();
      if (!campaign)
        return {
          ok: false,
          status: 400,
          error: "Choose an active campaign.",
        };
    }
  }

  const { data: feedback, error } = await supabaseAdmin
    .from("feedback")
    .insert({
      from_user_id: input.fromUserId,
      to_user_id: recipientIds[0],
      message,
      visibility,
      emoji: visibility === "public" ? (input.emoji ?? null) : null,
      value_id: visibility === "public" ? (input.valueId ?? null) : null,
      campaign_id: visibility === "public" ? (input.campaignId ?? null) : null,
      media_url: visibility === "public" ? (input.mediaUrl ?? null) : null,
    })
    .select("id")
    .single();
  if (error || !feedback)
    return {
      ok: false,
      status: 500,
      error: error?.message ?? "Could not save.",
    };

  const { error: recipientsError } = await supabaseAdmin
    .from("feedback_recipients")
    .insert(
      recipientIds.map((user_id) => ({ feedback_id: feedback.id, user_id })),
    );
  if (recipientsError)
    return { ok: false, status: 500, error: recipientsError.message };

  if (visibility === "public")
    await notifyFeedbackMentions({
      feedbackId: feedback.id,
      text: message,
      actorId: input.fromUserId,
    });
  // The recipient's private list changed; the public wall only if it was public.
  await Promise.all(
    recipientIds.map((recipientId) =>
      invalidateUserPrivateFeedback(recipientId),
    ),
  );
  if (visibility === "public") {
    await invalidatePublicFeedback();

    const valueName = recognitionValues.find(
      (value) => value.id === input.valueId,
    )?.name;
    const recipientById = new Map(
      (recipients ?? []).map((recipient) => [recipient.id, recipient]),
    );
    const { data: culturePrefs } = await supabaseAdmin
      .from("user_notification_preferences")
      .select("user_id,culture_announcements")
      .in("user_id", [input.fromUserId, ...recipientIds]);
    const cultureOptIns = new Set(
      (culturePrefs ?? [])
        .filter((pref: { culture_announcements: boolean | null }) =>
          Boolean(pref.culture_announcements),
        )
        .map((pref: { user_id: string }) => pref.user_id),
    );
    const appUrl = process.env.PRODUCTION_APP_URL ?? "http://localhost:3000";
    await Promise.all([
      ...recipientIds.map((recipientId) => {
        const messageForRecipient = buildRecognitionReceivedMessage({
          senderName: input.senderName,
          valueName,
          message,
          appUrl,
        });
        return deliverSlackNotification({
          eventKey: `recognition-dm:${feedback.id}:${recipientId}`,
          recipientUserId: recipientId,
          category: "recognition_received",
          text: messageForRecipient.text,
          blocks: messageForRecipient.blocks,
          // Recognition is timely even for staff who otherwise chose digest
          // delivery. Quiet hours and the global Slack switch still apply.
          digest: true,
        });
      }),
      (() => {
        const channelMessage = buildPublicRecognitionMessage({
          recipientName: cultureOptIns.has(recipientIds[0])
            ? (recipientById.get(recipientIds[0])?.name ?? null)
            : null,
          senderName: cultureOptIns.has(input.fromUserId)
            ? input.senderName
            : null,
          valueName,
          message,
          mediaUrl: input.mediaUrl ?? null,
          appUrl,
        });
        return postSlackChannelNotification({
          eventKey: `culture:recognition:${feedback.id}`,
          category: "culture_recognition",
          text: channelMessage.text,
          blocks: channelMessage.blocks,
        });
      })(),
    ]);
  }

  await runAutomationEvent({
    trigger: "recognition_received",
    eventKey: `feedback:${feedback.id}`,
    recipientIds,
    notification: (userId) =>
      notifyRecognitionReceived(userId, input.senderName, message),
    pointReason: "Recognition received automation",
    referenceId: feedback.id,
  });

  return { ok: true, feedbackId: feedback.id };
}
