import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { invalidatePublicFeedback } from "@/lib/cache/invalidate";
import { supabaseAdmin } from "@/lib/supabase";

type RouteContext = { params: Promise<{ id: string }> };

const EMOJIS = ["❤️", "🎉", "👏", "🔥"] as const;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/** Toggle the signed-in user's lightweight reaction on a public recognition. */
export async function POST(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id))
    return NextResponse.json(
      { error: "Invalid recognition." },
      { status: 400 },
    );

  const body = (await request.json().catch(() => null)) as {
    emoji?: unknown;
  } | null;
  const emoji = body?.emoji;
  if (
    typeof emoji !== "string" ||
    !EMOJIS.includes(emoji as (typeof EMOJIS)[number])
  )
    return NextResponse.json(
      { error: "Choose a valid reaction." },
      { status: 400 },
    );

  const { data: recognition, error: recognitionError } = await supabaseAdmin
    .from("feedback")
    .select("id")
    .eq("id", id)
    .eq("visibility", "public")
    .maybeSingle();
  if (recognitionError)
    return NextResponse.json(
      { error: recognitionError.message },
      { status: 500 },
    );
  if (!recognition)
    return NextResponse.json(
      { error: "Recognition not found." },
      { status: 404 },
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table awaits generated types
  const db = supabaseAdmin as any;
  const { data: existing, error: lookupError } = await db
    .from("feedback_reactions")
    .select("feedback_id")
    .eq("feedback_id", id)
    .eq("user_id", session.user.id)
    .eq("emoji", emoji)
    .maybeSingle();
  if (lookupError)
    return NextResponse.json({ error: lookupError.message }, { status: 500 });

  if (existing) {
    const { error } = await db
      .from("feedback_reactions")
      .delete()
      .eq("feedback_id", id)
      .eq("user_id", session.user.id)
      .eq("emoji", emoji);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    await invalidatePublicFeedback();
    return NextResponse.json({ active: false });
  }

  const { error } = await db.from("feedback_reactions").insert({
    feedback_id: id,
    user_id: session.user.id,
    emoji,
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidatePublicFeedback();
  return NextResponse.json({ active: true });
}
