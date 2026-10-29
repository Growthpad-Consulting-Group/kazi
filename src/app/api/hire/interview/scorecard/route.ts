import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";
import type { Database } from "@/types/database";

type ScorecardAnswer = { question: string; answer: string; score: number };
type Recommendation = "hire" | "maybe" | "no_hire";

/**
 * Submit an interview scorecard.
 *
 * The interviewer id always comes from the session — never from the request
 * body — so a caller cannot submit a scorecard on someone else's behalf.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    !["admin", "hr", "hiring_manager", "interviewer"].includes(
      session.user.role,
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { candidateId, questions, recommendation } = (await req.json()) as {
    candidateId?: string;
    questions?: ScorecardAnswer[];
    recommendation?: Recommendation | "";
  };

  if (!candidateId || !Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json(
      { error: "candidateId and questions required" },
      { status: 400 },
    );
  }

  // Guard against malformed payloads: score must be a number in 0..5.
  const filled = questions.map((q) => ({
    question: String(q.question ?? ""),
    answer: String(q.answer ?? ""),
    score: Math.min(5, Math.max(0, Number(q.score) || 0)),
  }));

  const totalScore =
    filled.reduce((sum, q) => sum + q.score, 0) / filled.length;

  const payload: Database["public"]["Tables"]["interview_scorecards"]["Insert"] =
    {
      candidate_id: candidateId,
      interviewer_id: session.user.id,
      questions: filled,
      overall_score: Math.round(totalScore * 10) / 10,
      recommendation: recommendation || null,
      submitted_at: new Date().toISOString(),
    };

  const { error } = await supabaseAdmin
    .from("interview_scorecards")
    .upsert(payload, { onConflict: "candidate_id,interviewer_id" });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  // The scorecard feeds the candidate's cached pipeline entry.
  await invalidateTables("interview_scorecards");
  return NextResponse.json({ ok: true });
}
