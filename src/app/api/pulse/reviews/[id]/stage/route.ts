import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";
import {
  NEXT_REVIEW_STATUS,
  generateCycleReviews,
  notifyOutstandingReviewers,
} from "@/lib/reviews";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_reviews"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed release field
  const db = supabaseAdmin as any;

  const { data: cycle } = await db
    .from("review_cycles")
    .select("status, title, end_date, results_released_at, min_peer_reviews")
    .eq("id", id)
    .maybeSingle();
  if (!cycle)
    return NextResponse.json(
      { error: "Review cycle not found." },
      { status: 404 },
    );
  const {
    status: current,
    title,
    end_date,
  } = cycle as {
    status: keyof typeof NEXT_REVIEW_STATUS | "completed";
    title: string;
    end_date: string;
    min_peer_reviews: number;
  };
  const body = (await req.json().catch(() => null)) as {
    action?: string;
    waiverReason?: string;
    dueDate?: string;
  } | null;
  if (body?.action === "extend_deadline") {
    const field =
      current === "self_review"
        ? "self_review_due_date"
        : current === "manager_review"
          ? "manager_review_due_date"
          : current === "peer_review"
            ? "peer_review_due_date"
            : null;
    if (!field || !body.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate))
      return NextResponse.json(
        { error: "Choose a valid active-stage deadline." },
        { status: 400 },
      );
    const { error } = await db
      .from("review_cycles")
      .update({ [field]: body.dueDate })
      .eq("id", id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed audit table
    await (supabaseAdmin as any).from("performance_review_audit_logs").insert({
      cycle_id: id,
      actor_id: session.user.id,
      action: "deadline_extended",
      metadata: { stage: current, dueDate: body.dueDate },
    });
    return NextResponse.json({ ok: true });
  }
  if (current === "completed") {
    if (body?.action !== "release_results")
      return NextResponse.json(
        { error: "This cycle is already complete." },
        { status: 409 },
      );
    if ((cycle as { results_released_at: string | null }).results_released_at)
      return NextResponse.json(
        { error: "Results have already been released." },
        { status: 409 },
      );
    const releasedAt = new Date().toISOString();
    const { error } = await db
      .from("review_cycles")
      .update({ results_released_at: releasedAt })
      .eq("id", id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed audit table
    await (supabaseAdmin as any).from("performance_review_audit_logs").insert({
      cycle_id: id,
      actor_id: session.user.id,
      action: "results_released",
    });
    await invalidateTables("review_cycles", "performance_reviews");
    return NextResponse.json({
      status: current,
      resultsReleasedAt: releasedAt,
    });
  }

  const next = NEXT_REVIEW_STATUS[current];
  const typeByStage = {
    self_review: "self",
    manager_review: "manager",
    peer_review: "peer",
  } as const;
  const reviewType = typeByStage[current as keyof typeof typeByStage];
  if (reviewType) {
    const { count, error: outstandingError } = await supabaseAdmin
      .from("performance_reviews")
      .select("id", { count: "exact", head: true })
      .eq("cycle_id", id)
      .eq("review_type", reviewType)
      .is("submitted_at", null);
    if (outstandingError)
      return NextResponse.json(
        { error: outstandingError.message },
        { status: 500 },
      );
    if ((count ?? 0) > 0 && (body?.waiverReason?.trim().length ?? 0) < 10)
      return NextResponse.json(
        {
          error: `${count} review${count === 1 ? " is" : "s are"} still outstanding. Add a waiver reason to move the cycle on.`,
        },
        { status: 409 },
      );
    if ((count ?? 0) > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed audit table
      await (supabaseAdmin as any)
        .from("performance_review_audit_logs")
        .insert({
          cycle_id: id,
          actor_id: session.user.id,
          action: "stage_waived",
          metadata: {
            stage: current,
            outstanding: count,
            reason: body?.waiverReason?.trim(),
          },
        });
    }
    if (current === "peer_review" && (count ?? 0) === 0) {
      const { data: peerAssignments, error: peersError } = await supabaseAdmin
        .from("performance_reviews")
        .select("reviewee_id")
        .eq("cycle_id", id)
        .eq("review_type", "peer");
      if (peersError)
        return NextResponse.json(
          { error: peersError.message },
          { status: 500 },
        );
      const { data: reviewees, error: revieweesError } = await supabaseAdmin
        .from("performance_reviews")
        .select("reviewee_id")
        .eq("cycle_id", id)
        .eq("review_type", "self");
      if (revieweesError)
        return NextResponse.json(
          { error: revieweesError.message },
          { status: 500 },
        );
      const peerCountByReviewee = new Map<string, number>();
      for (const assignment of peerAssignments ?? []) {
        peerCountByReviewee.set(
          assignment.reviewee_id,
          (peerCountByReviewee.get(assignment.reviewee_id) ?? 0) + 1,
        );
      }
      const minimumPeers = Math.max(0, Number(cycle.min_peer_reviews) || 0);
      const belowMinimum = (reviewees ?? []).filter(
        (reviewee) =>
          (peerCountByReviewee.get(reviewee.reviewee_id) ?? 0) < minimumPeers,
      ).length;
      if (belowMinimum > 0 && (body?.waiverReason?.trim().length ?? 0) < 10)
        return NextResponse.json(
          {
            error: `${belowMinimum} staff member${belowMinimum === 1 ? " is" : "s are"} below the ${minimumPeers}-peer minimum. Add a waiver reason to complete the cycle.`,
          },
          { status: 409 },
        );
      if (belowMinimum > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed audit table
        await (supabaseAdmin as any)
          .from("performance_review_audit_logs")
          .insert({
            cycle_id: id,
            actor_id: session.user.id,
            action: "stage_waived",
            metadata: {
              stage: current,
              outstanding: 0,
              reason: body?.waiverReason?.trim(),
              belowPeerMinimum: belowMinimum,
              minimumPeers,
            },
          });
      }
    }
  }
  if (current === "pending") await generateCycleReviews(id);

  const { error } = await supabaseAdmin
    .from("review_cycles")
    .update({ status: next })
    .eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed audit table
  await (supabaseAdmin as any).from("performance_review_audit_logs").insert({
    cycle_id: id,
    actor_id: session.user.id,
    action: "stage_changed",
    metadata: { from: current, to: next },
  });
  await invalidateTables("review_cycles", "performance_reviews");
  if (next !== "completed") {
    await notifyOutstandingReviewers(id, next, {
      cycleTitle: title,
      dueDate: end_date,
      overdue: false,
      opening: true,
    });
  }
  return NextResponse.json({ status: next });
}
