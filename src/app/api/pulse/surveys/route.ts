import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_surveys")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title, description, anonymous, questions, created_by } = await req.json();
  if (!title || !Array.isArray(questions) || !questions.length) {
    return NextResponse.json({ error: "title and questions required" }, { status: 400 });
  }
  const validQuestions = questions.every((question) => question && typeof question.id === "string" && typeof question.text === "string" && ["scale", "text", "choice", "quiz"].includes(question.type) && ((question.type !== "choice" && question.type !== "quiz") || (Array.isArray(question.options) && question.options.filter((option: unknown) => typeof option === "string" && option.trim()).length >= 2)) && (question.type !== "quiz" || (typeof question.correct_answer === "string" && question.options.includes(question.correct_answer) && typeof question.time_limit_seconds === "number" && question.time_limit_seconds >= 10)));
  if (!validQuestions) return NextResponse.json({ error: "Each question must be valid; polls need at least two options." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("surveys")
    .insert({ title, description: description ?? null, anonymous: anonymous ?? true, questions, created_by })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateTables("surveys");
  return NextResponse.json({ id: (data as unknown as { id: string }).id });
}
