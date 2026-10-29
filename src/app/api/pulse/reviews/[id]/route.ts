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
    .select("reviewer_id, review_type, cycle_id")
    .eq("id", id)
    .single();

  const review = existing as unknown as {
    reviewer_id: string;
    review_type: keyof typeof REVIEW_TYPE_STAGE;
    cycle_id: string;
  } | null;
  if (!review || review.reviewer_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
  if (body.competency_ratings !== undefined)
    update.competency_ratings = body.competency_ratings;
  if (body.overall_rating !== undefined)
    update.overall_rating = body.overall_rating;
  if (body.strengths !== undefined) update.strengths = body.strengths;
  if (body.development_areas !== undefined)
    update.development_areas = body.development_areas;
  if (body.ai_draft !== undefined) update.ai_draft = body.ai_draft;
  if (body.submitted_at !== undefined) update.submitted_at = body.submitted_at;

  const { error } = await supabaseAdmin
    .from("performance_reviews")
    .update(update)
    .eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateTables("performance_reviews");
  return NextResponse.json({ ok: true });
}
