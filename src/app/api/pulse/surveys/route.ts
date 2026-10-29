import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";
import {
  audienceRows,
  validateAudience,
} from "@/features/pulse/surveys/audience";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_surveys")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const {
    title,
    description,
    anonymous,
    questions,
    opensAt,
    closesAt,
    audienceType,
    audienceIds,
    audienceDepartments,
  } = await req.json();
  if (
    typeof title !== "string" ||
    !title.trim() ||
    !Array.isArray(questions) ||
    !questions.length
  ) {
    return NextResponse.json(
      { error: "title and questions required" },
      { status: 400 },
    );
  }
  const validQuestions = questions.every(
    (question) =>
      question &&
      typeof question.id === "string" &&
      typeof question.text === "string" &&
      ["scale", "text", "choice", "quiz"].includes(question.type) &&
      ((question.type !== "choice" && question.type !== "quiz") ||
        (Array.isArray(question.options) &&
          question.options.filter(
            (option: unknown) => typeof option === "string" && option.trim(),
          ).length >= 2)) &&
      (question.type !== "quiz" ||
        (typeof question.correct_answer === "string" &&
          question.options.includes(question.correct_answer) &&
          typeof question.time_limit_seconds === "number" &&
          question.time_limit_seconds >= 10)),
  );
  if (!validQuestions)
    return NextResponse.json(
      {
        error: "Each question must be valid; polls need at least two options.",
      },
      { status: 400 },
    );

  const audience = validateAudience({
    audienceType,
    audienceIds,
    audienceDepartments,
  });
  if (!audience.ok)
    return NextResponse.json({ error: audience.error }, { status: 400 });
  const opensAtDate = opensAt ? new Date(opensAt) : null;
  const closesAtDate = closesAt ? new Date(closesAt) : null;
  if (
    (opensAt && Number.isNaN(opensAtDate?.getTime())) ||
    (closesAt && Number.isNaN(closesAtDate?.getTime()))
  )
    return NextResponse.json(
      { error: "Choose valid survey dates." },
      { status: 400 },
    );
  if (opensAtDate && closesAtDate && closesAtDate <= opensAtDate)
    return NextResponse.json(
      { error: "The closing date must be after the opening date." },
      { status: 400 },
    );

  const { data, error } = await supabaseAdmin
    .from("surveys")
    .insert({
      title: title.trim(),
      description:
        typeof description === "string" ? description.trim() || null : null,
      anonymous: anonymous ?? true,
      questions,
      created_by: session.user.id,
      opens_at: opensAtDate?.toISOString() ?? null,
      closes_at: closesAtDate?.toISOString() ?? null,
    })
    .select("id")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  const surveyId = (data as unknown as { id: string }).id;
  const rows = audienceRows(audience).map((row) => ({
    survey_id: surveyId,
    ...row,
  }));
  if (rows.length) {
    const { error: audienceError } = await supabaseAdmin
      .from("survey_audiences")
      .insert(rows);
    if (audienceError) {
      await supabaseAdmin.from("surveys").delete().eq("id", surveyId);
      return NextResponse.json(
        { error: audienceError.message },
        { status: 500 },
      );
    }
  }
  await invalidateTables("surveys");
  return NextResponse.json({ id: surveyId });
}
