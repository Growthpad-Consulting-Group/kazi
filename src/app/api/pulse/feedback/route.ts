import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  invalidatePublicFeedback,
  invalidateUserPrivateFeedback,
} from "@/lib/cache/invalidate";
import type { FeedbackVisibility } from "@/types/database";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { from_user_id, to_user_id, to_user_ids, message, visibility, emoji, value_id, campaign_id } = await req.json();
  const recipientIds = [...new Set(Array.isArray(to_user_ids) ? to_user_ids.filter((id): id is string => typeof id === "string") : [to_user_id].filter((id): id is string => typeof id === "string"))];

  if (from_user_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!recipientIds.length || !message?.trim()) {
    return NextResponse.json({ error: "Choose at least one recipient and add a message." }, { status: 400 });
  }
  if (recipientIds.includes(session.user.id)) return NextResponse.json({ error: "You cannot send feedback to yourself." }, { status: 400 });
  if (visibility !== "public" && recipientIds.length > 1) return NextResponse.json({ error: "Private feedback can only have one recipient." }, { status: 400 });
  const { data: recipients } = await supabaseAdmin.from("users").select("id").in("id", recipientIds).eq("is_active", true);
  if ((recipients?.length ?? 0) !== recipientIds.length) return NextResponse.json({ error: "One or more recipients are unavailable." }, { status: 400 });
  if (visibility === "public") {
    const { data: values } = await supabaseAdmin.from("recognition_values").select("id").eq("is_active", true);
    if ((values?.length ?? 0) > 0 && !value_id) return NextResponse.json({ error: "Choose the value this recognition represents." }, { status: 400 });
    if (value_id && !values?.some((value) => value.id === value_id)) return NextResponse.json({ error: "Choose an active recognition value." }, { status: 400 });
    if (campaign_id) {
      const { data: campaign } = await supabaseAdmin.from("recognition_campaigns").select("id").eq("id", campaign_id).eq("status", "live").maybeSingle();
      if (!campaign) return NextResponse.json({ error: "Choose an active campaign." }, { status: 400 });
    }
  }

  const { data: feedback, error } = await supabaseAdmin.from("feedback").insert({
    from_user_id,
    to_user_id: recipientIds[0],
    message: message.trim(),
    visibility: (visibility ?? "public") as FeedbackVisibility,
    emoji: visibility === "public" ? (emoji ?? null) : null,
    value_id: visibility === "public" ? (value_id ?? null) : null,
    campaign_id: visibility === "public" ? (campaign_id ?? null) : null,
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { error: recipientsError } = await supabaseAdmin.from("feedback_recipients").insert(recipientIds.map((user_id) => ({ feedback_id: feedback.id, user_id })));
  if (recipientsError) return NextResponse.json({ error: recipientsError.message }, { status: 500 });
  // The recipient's private list changed; the public wall only if it was public.
  await Promise.all(recipientIds.map((recipientId) => invalidateUserPrivateFeedback(recipientId)));
  if (visibility === "public") await invalidatePublicFeedback();
  return NextResponse.json({ ok: true });
}
