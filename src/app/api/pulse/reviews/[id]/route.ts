import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Verify reviewer owns this review
  const { data: existing } = await supabaseAdmin
    .from("performance_reviews")
    .select("reviewer_id")
    .eq("id", id)
    .single();

  if (!existing || (existing as unknown as { reviewer_id: string }).reviewer_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  type ReviewUpdate = {
    competency_ratings?: { criterion: string; rating: number; comment: string }[];
    overall_rating?: number | null;
    strengths?: string | null;
    development_areas?: string | null;
    ai_draft?: string | null;
    submitted_at?: string | null;
  };

  const update: ReviewUpdate = {};
  if (body.competency_ratings !== undefined) update.competency_ratings = body.competency_ratings;
  if (body.overall_rating !== undefined) update.overall_rating = body.overall_rating;
  if (body.strengths !== undefined) update.strengths = body.strengths;
  if (body.development_areas !== undefined) update.development_areas = body.development_areas;
  if (body.ai_draft !== undefined) update.ai_draft = body.ai_draft;
  if (body.submitted_at !== undefined) update.submitted_at = body.submitted_at;

  const { error } = await supabaseAdmin.from("performance_reviews").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateTables("performance_reviews");
  return NextResponse.json({ ok: true });
}
