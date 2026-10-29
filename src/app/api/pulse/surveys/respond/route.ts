import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";
import { isSurveyAudienceMember } from "@/features/pulse/surveys/audience";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The respondent is always the signed-in user — a client-supplied id is
  // never trusted, so that answers cannot be attributed to someone else.
  const { surveyId, answers } = await req.json();
  if (
    typeof surveyId !== "string" ||
    !surveyId ||
    !answers ||
    typeof answers !== "object" ||
    Array.isArray(answers)
  )
    return NextResponse.json(
      { error: "surveyId and answers required" },
      { status: 400 },
    );

  // Check survey is active
  const { data: survey } = await supabaseAdmin
    .from("surveys")
    .select("status, anonymous, questions, opens_at, closes_at")
    .eq("id", surveyId)
    .single();
  if (
    !survey ||
    (survey as unknown as { status: string }).status !== "active"
  ) {
    return NextResponse.json(
      { error: "Survey is not active" },
      { status: 400 },
    );
  }
  const schedule = survey as unknown as {
    opens_at: string | null;
    closes_at: string | null;
  };
  const now = new Date();
  if (
    (schedule.opens_at && new Date(schedule.opens_at) > now) ||
    (schedule.closes_at && new Date(schedule.closes_at) <= now)
  )
    return NextResponse.json(
      { error: "This survey is not accepting responses right now." },
      { status: 400 },
    );
  if (!(await isSurveyAudienceMember(surveyId, session.user.id)))
    return NextResponse.json(
      { error: "This survey is not available to you." },
      { status: 403 },
    );
  const questions = (
    survey as unknown as {
      questions: {
        id: string;
        type: "scale" | "text" | "choice" | "quiz";
        options?: string[];
        correct_answer?: string;
      }[];
    }
  ).questions;
  const validAnswers = questions.every((question) => {
    const answer = answers[question.id];
    if (answer === undefined || answer === "") return false;
    if (question.type === "scale")
      return typeof answer === "number" && answer >= 1 && answer <= 5;
    if (question.type === "choice" || question.type === "quiz")
      return typeof answer === "string" && question.options?.includes(answer);
    return typeof answer === "string";
  });
  if (!validAnswers)
    return NextResponse.json(
      { error: "Please answer every question with a valid response." },
      { status: 400 },
    );

  // Participation is intentionally separate from the response. This preserves
  // anonymous answers while the unique key enforces one response per person.
  const { error: participationError } = await supabaseAdmin
    .from("survey_participants")
    .insert({ survey_id: surveyId, user_id: session.user.id });
  if (participationError) {
    if (participationError.code === "23505")
      return NextResponse.json({ error: "Already responded" }, { status: 409 });
    return NextResponse.json(
      { error: participationError.message },
      { status: 500 },
    );
  }

  const quizQuestions = questions.filter(
    (question) => question.type === "quiz",
  );
  const score = quizQuestions.length
    ? quizQuestions.reduce(
        (total, question) =>
          total + (answers[question.id] === question.correct_answer ? 1 : 0),
        0,
      )
    : null;
  const { error } = await supabaseAdmin.from("survey_responses").insert({
    survey_id: surveyId,
    respondent_id: (survey as unknown as { anonymous: boolean }).anonymous
      ? null
      : session.user.id,
    answers: {
      ...answers,
      ...(score === null
        ? {}
        : { _quiz_score: score, _quiz_total: quizQuestions.length }),
    },
  });

  if (error) {
    await supabaseAdmin
      .from("survey_participants")
      .delete()
      .eq("survey_id", surveyId)
      .eq("user_id", session.user.id);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await invalidateTables("survey_responses", "survey_participants");
  return NextResponse.json({ ok: true, score, total: quizQuestions.length });
}
