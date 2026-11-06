import { NextResponse } from "next/server";
import { notifyFeedbackMentions } from "@/lib/pulse-mentions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  invalidatePublicFeedback,
  invalidateUserPrivateFeedback,
} from "@/lib/cache/invalidate";
import { awardPoints } from "@/lib/award-points";
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

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    from_user_id,
    to_user_id,
    to_user_ids,
    message,
    visibility,
    emoji,
    value_id,
    campaign_id,
    media_url,
  } = await req.json();
  const recipientIds = [
    ...new Set(
      Array.isArray(to_user_ids)
        ? to_user_ids.filter((id): id is string => typeof id === "string")
        : [to_user_id].filter((id): id is string => typeof id === "string"),
    ),
  ];

  if (from_user_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!recipientIds.length || !message?.trim()) {
    return NextResponse.json(
      { error: "Choose at least one recipient and add a message." },
      { status: 400 },
    );
  }
  if (recipientIds.includes(session.user.id))
    return NextResponse.json(
      { error: "You cannot send feedback to yourself." },
      { status: 400 },
    );
  if (visibility !== "public" && recipientIds.length > 1)
    return NextResponse.json(
      { error: "Private feedback can only have one recipient." },
      { status: 400 },
    );
  const { data: recipients } = await supabaseAdmin
    .from("users")
    .select("id,name")
    .in("id", recipientIds)
    .eq("is_active", true);
  if ((recipients?.length ?? 0) !== recipientIds.length)
    return NextResponse.json(
      { error: "One or more recipients are unavailable." },
      { status: 400 },
    );
  let recognitionValues: { id: string; name: string }[] = [];
  if (visibility === "public") {
    const { data: values } = await supabaseAdmin
      .from("recognition_values")
      .select("id,name")
      .eq("is_active", true);
    recognitionValues = values ?? [];
    if ((values?.length ?? 0) > 0 && !value_id)
      return NextResponse.json(
        { error: "Choose the value this recognition represents." },
        { status: 400 },
      );
    if (value_id && !values?.some((value) => value.id === value_id))
      return NextResponse.json(
        { error: "Choose an active recognition value." },
        { status: 400 },
      );
    if (campaign_id) {
      const { data: campaign } = await supabaseAdmin
        .from("recognition_campaigns")
        .select("id")
        .eq("id", campaign_id)
        .eq("status", "live")
        .maybeSingle();
      if (!campaign)
        return NextResponse.json(
          { error: "Choose an active campaign." },
          { status: 400 },
        );
    }
  }

  const { data: feedback, error } = await supabaseAdmin
    .from("feedback")
    .insert({
      from_user_id,
      to_user_id: recipientIds[0],
      message: message.trim(),
      visibility: (visibility ?? "public") as FeedbackVisibility,
      emoji: visibility === "public" ? (emoji ?? null) : null,
      value_id: visibility === "public" ? (value_id ?? null) : null,
      campaign_id: visibility === "public" ? (campaign_id ?? null) : null,
      media_url: visibility === "public" ? (media_url ?? null) : null,
    })
    .select("id")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  const { error: recipientsError } = await supabaseAdmin
    .from("feedback_recipients")
    .insert(
      recipientIds.map((user_id) => ({ feedback_id: feedback.id, user_id })),
    );
  if (recipientsError)
    return NextResponse.json(
      { error: recipientsError.message },
      { status: 500 },
    );
  if (visibility === "public" && feedback)
    await notifyFeedbackMentions({
      feedbackId: feedback.id,
      text: message.trim(),
      actorId: from_user_id,
    });
  // The recipient's private list changed; the public wall only if it was public.
  await Promise.all(
    recipientIds.map((recipientId) =>
      invalidateUserPrivateFeedback(recipientId),
    ),
  );
  if (visibility === "public") await invalidatePublicFeedback();
  if (visibility === "public") {
    const valueName = recognitionValues.find(
      (value) => value.id === value_id,
    )?.name;
    const recipientById = new Map(
      (recipients ?? []).map((recipient) => [recipient.id, recipient]),
    );
    const { data: culturePrefs } = await supabaseAdmin
      .from("user_notification_preferences")
      .select("user_id,culture_announcements")
      .in("user_id", [from_user_id, ...recipientIds]);
    const cultureOptIns = new Set(
      (culturePrefs ?? [])
        .filter((pref: { culture_announcements: boolean | null }) =>
          Boolean(pref.culture_announcements),
        )
        .map((pref: { user_id: string }) => pref.user_id),
    );
    const senderName = session.user.name ?? "A colleague";
    const appUrl = process.env.PRODUCTION_APP_URL ?? "http://localhost:3000";
    await Promise.all([
      ...recipientIds.map((recipientId) => {
        const messageForRecipient = buildRecognitionReceivedMessage({
          senderName,
          valueName,
          message: message.trim(),
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
          senderName: cultureOptIns.has(from_user_id) ? senderName : null,
          valueName,
          message: message.trim(),
          mediaUrl: media_url ?? null,
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
  // Award +5 points to giver for public recognition (non-blocking)
  if (visibility === "public") {
    try {
      await awardPoints({
        userId: from_user_id,
        amount: 5,
        reason: "Public recognition given",
        referenceType: "feedback",
        referenceId: feedback.id,
        createdBy: null,
      });
    } catch {
      /* non-blocking */
    }
  }
  await runAutomationEvent({
    trigger: "recognition_received",
    eventKey: `feedback:${feedback.id}`,
    recipientIds,
    notification: (userId) =>
      notifyRecognitionReceived(
        userId,
        session.user.name ?? "A colleague",
        message.trim(),
      ),
    pointReason: "Recognition received automation",
    referenceId: feedback.id,
  });
  return NextResponse.json({ ok: true });
}
