import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createRecognition } from "@/lib/recognition-create";
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

  if (from_user_id !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const recipientIds = [
    ...new Set(
      Array.isArray(to_user_ids)
        ? to_user_ids.filter((id): id is string => typeof id === "string")
        : [to_user_id].filter((id): id is string => typeof id === "string"),
    ),
  ];

  const result = await createRecognition({
    fromUserId: session.user.id,
    senderName: session.user.name ?? "A colleague",
    recipientIds,
    message: typeof message === "string" ? message : "",
    visibility: (visibility ?? "public") as FeedbackVisibility,
    emoji: emoji ?? null,
    valueId: value_id ?? null,
    campaignId: campaign_id ?? null,
    mediaUrl: media_url ?? null,
  });

  if (!result.ok)
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  return NextResponse.json({ ok: true });
}
