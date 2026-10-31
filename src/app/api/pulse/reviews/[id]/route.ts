import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";
import { REVIEW_TYPE_STAGE } from "@/lib/reviews";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Verify reviewer owns this review
  const { data: existing } = await supabaseAdmin
    .from("performance_reviews")
    .select("reviewer_id, review_type, cycle_id, submitted_at")
    .eq("id", id)
    .single();

  const review = existing as unknown as {
    reviewer_id: string;
    review_type: keyof typeof REVIEW_TYPE_STAGE;
    cycle_id: string;
    submitted_at: string | null;
  } | null;
  if (!review || review.reviewer_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (review.submitted_at)
    return NextResponse.json(
      {
        error:
          "Submitted reviews are locked. Ask HR to reopen the cycle if a correction is needed.",
      },
      { status: 409 },
    );

  const { data: cycle } = await supabaseAdmin
    .from("review_cycles")
    .select("status")
    .eq("id", review.cycle_id)
    .maybeSingle();
  const stage = (cycle as { status: string } | null)?.status;
  if (stage !== REVIEW_TYPE_STAGE[review.review_type]) {
    return NextResponse.json(
      {
        error:
          "This review isn't open for editing yet, or the cycle has moved on.",
      },
      { status: 409 },
    );
  }

  type ReviewUpdate = {
    competency_ratings?: {
      criterion: string;
      rating: number;
      comment: string;
    }[];
    overall_rating?: number | null;
    strengths?: string | null;
    development_areas?: string | null;
    ai_draft?: string | null;
    submitted_at?: string | null;
  };

  const update: ReviewUpdate = {};
  const ratingsAreValid =
    Array.isArray(body.competency_ratings) &&
    body.competency_ratings.length > 0 &&
    body.competency_ratings.length <= 15 &&
    body.competency_ratings.every(
      (rating: unknown) =>
        typeof rating === "object" &&
        rating !== null &&
        typeof (rating as { criterion?: unknown }).criterion === "string" &&
        (rating as { criterion: string }).criterion.trim().length > 0 &&
        (rating as { criterion: string }).criterion.length <= 120 &&
        Number.isInteger((rating as { rating?: unknown }).rating) &&
        (rating as { rating: number }).rating >= 1 &&
        (rating as { rating: number }).rating <= 5 &&
        typeof (rating as { comment?: unknown }).comment === "string" &&
        (rating as { comment: string }).comment.length <= 1000,
    );
  if (body.competency_ratings !== undefined && !ratingsAreValid)
    return NextResponse.json(
      { error: "Use between 1 and 15 competency ratings from 1 to 5." },
      { status: 400 },
    );
  if (body.competency_ratings !== undefined)
    update.competency_ratings = body.competency_ratings;
  if (
    body.overall_rating !== undefined &&
    (typeof body.overall_rating !== "number" ||
      body.overall_rating < 1 ||
      body.overall_rating > 5)
  )
    return NextResponse.json(
      { error: "Overall rating must be between 1 and 5." },
      { status: 400 },
    );
  if (body.overall_rating !== undefined)
    update.overall_rating = body.overall_rating;
  for (const field of ["strengths", "development_areas", "ai_draft"] as const) {
    if (
      body[field] !== undefined &&
      (typeof body[field] !== "string" || body[field].length > 10_000)
    )
      return NextResponse.json(
        { error: "Review text is too long or invalid." },
        { status: 400 },
      );
  }
  if (body.strengths !== undefined) update.strengths = body.strengths;
  if (body.development_areas !== undefined)
    update.development_areas = body.development_areas;
  if (body.ai_draft !== undefined) update.ai_draft = body.ai_draft;
  if (body.submitted_at !== undefined) {
    if (body.submitted_at !== null && typeof body.submitted_at !== "string")
      return NextResponse.json(
        { error: "Invalid submission state." },
        { status: 400 },
      );
    update.submitted_at = body.submitted_at;
  }

  const { error } = await supabaseAdmin
    .from("performance_reviews")
    .update(update)
    .eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed audit table
  await (supabaseAdmin as any).from("performance_review_audit_logs").insert({
    cycle_id: review.cycle_id,
    review_id: id,
    actor_id: session.user.id,
    action: body.submitted_at ? "review_submitted" : "review_saved",
  });
  await invalidateTables("performance_reviews");
  return NextResponse.json({ ok: true });
}
