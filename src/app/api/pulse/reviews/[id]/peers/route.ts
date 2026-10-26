import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";

type RouteContext = { params: Promise<{ id: string }> };

async function canAssignFor(role: string, userId: string, revieweeId: string) {
  if (can(role as Parameters<typeof can>[0], "manage_reviews")) return true;
  const { data } = await supabaseAdmin.from("users").select("manager_id").eq("id", revieweeId).maybeSingle();
  return (data as { manager_id: string | null } | null)?.manager_id === userId;
}

export async function POST(req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;

  const body = await req.json().catch(() => null) as { revieweeId?: string; peerIds?: string[] } | null;
  const revieweeId = body?.revieweeId;
  const peerIds = [...new Set((body?.peerIds ?? []).filter((value) => typeof value === "string" && value !== revieweeId))];
  if (!revieweeId || !peerIds.length) return NextResponse.json({ error: "Choose a person and at least one peer." }, { status: 400 });
  if (!(await canAssignFor(session.user.role, session.user.id, revieweeId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = peerIds.map((peerId) => ({ cycle_id: id, reviewee_id: revieweeId, reviewer_id: peerId, review_type: "peer" as const }));
  const { error } = await supabaseAdmin
    .from("performance_reviews")
    .upsert(rows, { onConflict: "cycle_id,reviewee_id,reviewer_id,review_type", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateTables("performance_reviews");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;

  const body = await req.json().catch(() => null) as { reviewId?: string } | null;
  if (!body?.reviewId) return NextResponse.json({ error: "reviewId is required." }, { status: 400 });

  const { data: review } = await supabaseAdmin
    .from("performance_reviews")
    .select("reviewee_id, review_type, submitted_at, cycle_id")
    .eq("id", body.reviewId)
    .maybeSingle();
  const row = review as { reviewee_id: string; review_type: string; submitted_at: string | null; cycle_id: string } | null;
  if (!row || row.cycle_id !== id || row.review_type !== "peer") return NextResponse.json({ error: "Peer review not found." }, { status: 404 });
  if (row.submitted_at) return NextResponse.json({ error: "A submitted peer review can't be removed." }, { status: 409 });
  if (!(await canAssignFor(session.user.role, session.user.id, row.reviewee_id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabaseAdmin.from("performance_reviews").delete().eq("id", body.reviewId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateTables("performance_reviews");
  return NextResponse.json({ ok: true });
}
