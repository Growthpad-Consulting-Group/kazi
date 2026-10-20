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

  const { from_user_id, to_user_id, message, visibility, emoji } = await req.json();

  if (from_user_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!to_user_id || !message?.trim()) {
    return NextResponse.json({ error: "to_user_id and message required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("feedback").insert({
    from_user_id,
    to_user_id,
    message: message.trim(),
    visibility: (visibility ?? "public") as FeedbackVisibility,
    emoji: visibility === "public" ? (emoji ?? null) : null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // The recipient's private list changed; the public wall only if it was public.
  await invalidateUserPrivateFeedback(to_user_id);
  if (visibility === "public") await invalidatePublicFeedback();
  return NextResponse.json({ ok: true });
}
