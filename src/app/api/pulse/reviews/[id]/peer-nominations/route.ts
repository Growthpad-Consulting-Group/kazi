import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";
import { invalidateTables } from "@/lib/cache/invalidate";

type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Context) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: cycleId } = await params;
  const body = (await req.json().catch(() => null)) as {
    nomineeId?: unknown;
  } | null;
  const nomineeId = typeof body?.nomineeId === "string" ? body.nomineeId : "";
  if (!nomineeId)
    return NextResponse.json(
      { error: "Choose a colleague to nominate." },
      { status: 400 },
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed peer settings
  const db = supabaseAdmin as any;
  const { data: cycle } = await db
    .from("review_cycles")
    .select("status")
    .eq("id", cycleId)
    .maybeSingle();
  if (!cycle)
    return NextResponse.json({ error: "Cycle not found." }, { status: 404 });
  if (cycle.status !== "self_review")
    return NextResponse.json(
      { error: "Peer nominations are only open during self review." },
      { status: 409 },
    );
  if (nomineeId === session.user.id)
    return NextResponse.json(
      { error: "You cannot nominate yourself." },
      { status: 400 },
    );

  const { data: nominee } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", nomineeId)
    .eq("is_active", true)
    .maybeSingle();
  if (!nominee)
    return NextResponse.json(
      { error: "That colleague is unavailable." },
      { status: 400 },
    );

  const { error } = await db.from("review_peer_nominations").insert({
    cycle_id: cycleId,
    reviewee_id: session.user.id,
    nominee_id: nomineeId,
    requested_by: session.user.id,
  });
  if (error)
    return NextResponse.json(
      {
        error:
          error.code === "23505"
            ? "That colleague is already nominated."
            : error.message,
      },
      { status: error.code === "23505" ? 409 : 500 },
    );
  await invalidateTables("performance_reviews");
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: Context) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_reviews"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: cycleId } = await params;
  const body = (await req.json().catch(() => null)) as {
    nominationId?: unknown;
    action?: unknown;
  } | null;
  const nominationId =
    typeof body?.nominationId === "string" ? body.nominationId : "";
  const action = body?.action;
  if (!nominationId || !["approve", "reject"].includes(String(action)))
    return NextResponse.json(
      { error: "Choose a valid nomination action." },
      { status: 400 },
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables
  const db = supabaseAdmin as any;
  const { data: nomination } = await db
    .from("review_peer_nominations")
    .select("id, reviewee_id, nominee_id, status")
    .eq("id", nominationId)
    .eq("cycle_id", cycleId)
    .maybeSingle();
  if (!nomination)
    return NextResponse.json(
      { error: "Nomination not found." },
      { status: 404 },
    );
  if (nomination.status !== "pending")
    return NextResponse.json(
      { error: "This nomination has already been reviewed." },
      { status: 409 },
    );

  if (action === "approve") {
    const { data: cycle } = await db
      .from("review_cycles")
      .select("max_peer_reviews")
      .eq("id", cycleId)
      .single();
    const { count } = await supabaseAdmin
      .from("performance_reviews")
      .select("id", { count: "exact", head: true })
      .eq("cycle_id", cycleId)
      .eq("reviewee_id", nomination.reviewee_id)
      .eq("review_type", "peer");
    if ((count ?? 0) >= Number(cycle?.max_peer_reviews ?? 3))
      return NextResponse.json(
        {
          error:
            "This employee already has the maximum number of peer reviewers.",
        },
        { status: 409 },
      );
    const { error: reviewError } = await supabaseAdmin
      .from("performance_reviews")
      .insert({
        cycle_id: cycleId,
        reviewee_id: nomination.reviewee_id,
        reviewer_id: nomination.nominee_id,
        review_type: "peer",
      });
    if (reviewError)
      return NextResponse.json({ error: reviewError.message }, { status: 500 });
  }
  const { error } = await db
    .from("review_peer_nominations")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      reviewed_by: session.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", nominationId);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateTables("performance_reviews");
  return NextResponse.json({ ok: true });
}
