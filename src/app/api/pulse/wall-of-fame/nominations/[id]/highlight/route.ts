import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { userCan } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { broadcastWallOfFameChange } from "@/lib/wall-of-fame-realtime";

type RouteContext = { params: Promise<{ id: string }> };

/** Publishes the reviewed, anonymous summary used by staff during voting. */
export async function PATCH(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !userCan(session.user, "manage_recognition_campaigns"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    publicHighlight?: unknown;
  } | null;
  if (
    body?.publicHighlight !== undefined &&
    typeof body.publicHighlight !== "string"
  )
    return NextResponse.json(
      { error: "The public highlight must be text." },
      { status: 400 },
    );

  const publicHighlight =
    typeof body?.publicHighlight === "string"
      ? body.publicHighlight.trim()
      : "";
  if (
    publicHighlight &&
    (publicHighlight.length < 20 || publicHighlight.length > 500)
  )
    return NextResponse.json(
      { error: "Use between 20 and 500 characters for the public highlight." },
      { status: 400 },
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed fields
  const db = supabaseAdmin as any;
  const { data: nomination, error: lookupError } = await db
    .from("wall_of_fame_nominations")
    .select("id, cycle_id")
    .eq("id", id)
    .maybeSingle();
  if (lookupError)
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (!nomination)
    return NextResponse.json(
      { error: "Nomination not found." },
      { status: 404 },
    );

  const { error } = await db
    .from("wall_of_fame_nominations")
    .update({
      public_highlight: publicHighlight || null,
      public_highlight_approved_at: publicHighlight
        ? new Date().toISOString()
        : null,
      public_highlight_approved_by: publicHighlight ? session.user.id : null,
    })
    .eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  await broadcastWallOfFameChange(nomination.cycle_id).catch(() => {});
  return NextResponse.json({ ok: true });
}
