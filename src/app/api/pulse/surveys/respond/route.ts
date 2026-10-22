import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The respondent is always the signed-in user — a client-supplied id is
  // never trusted, so that answers cannot be attributed to someone else.
  const { surveyId, answers } = await req.json();
  if (!surveyId || !answers) return NextResponse.json({ error: "surveyId and answers required" }, { status: 400 });

  // Check survey is active
  const { data: survey } = await supabaseAdmin.from("surveys").select("status, anonymous, questions").eq("id", surveyId).single();
  if (!survey || (survey as unknown as { status: string }).status !== "active") {
    return NextResponse.json({ error: "Survey is not active" }, { status: 400 });
  }
  const questions = (survey as unknown as { questions: { id: string; type: "scale" | "text" | "choice" | "quiz"; options?: string[]; correct_answer?: string }[] }).questions;
  const validAnswers = questions.every((question) => {
    const answer = answers[question.id];
    if (answer === undefined || answer === "") return false;
    if (question.type === "scale") return typeof answer === "number" && answer >= 1 && answer <= 5;
    if (question.type === "choice" || question.type === "quiz") return typeof answer === "string" && question.options?.includes(answer);
    return typeof answer === "string";
  });
  if (!validAnswers) return NextResponse.json({ error: "Please answer every question with a valid response." }, { status: 400 });

  // Prevent duplicate responses
  const { data: existing } = await supabaseAdmin
    .from("survey_responses")
    .select("id")
    .eq("survey_id", surveyId)
    .eq("respondent_id", session.user.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "Already responded" }, { status: 409 });

  const quizQuestions = questions.filter((question) => question.type === "quiz");
  const score = quizQuestions.length ? quizQuestions.reduce((total, question) => total + (answers[question.id] === question.correct_answer ? 1 : 0), 0) : null;
  const { error } = await supabaseAdmin.from("survey_responses").insert({
    survey_id: surveyId,
    respondent_id: (survey as unknown as { anonymous: boolean }).anonymous ? null : session.user.id,
    answers: { ...answers, ...(score === null ? {} : { _quiz_score: score, _quiz_total: quizQuestions.length }) },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateTables("survey_responses");
  return NextResponse.json({ ok: true, score, total: quizQuestions.length });
}
