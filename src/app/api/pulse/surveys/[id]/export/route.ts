import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

const quote = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_surveys"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const [{ data: survey }, { data: responses }] = await Promise.all([
    supabaseAdmin
      .from("surveys")
      .select("title, questions")
      .eq("id", id)
      .maybeSingle(),
    supabaseAdmin
      .from("survey_responses")
      .select("answers, submitted_at")
      .eq("survey_id", id)
      .order("submitted_at"),
  ]);
  if (!survey)
    return NextResponse.json({ error: "Survey not found." }, { status: 404 });
  const questions = survey.questions as { id: string; text: string }[];
  const rows = [
    ["Submitted at", ...questions.map((question) => question.text)],
    ...(responses ?? []).map((response) => [
      response.submitted_at,
      ...questions.map((question) => response.answers[question.id] ?? ""),
    ]),
  ];
  return new NextResponse(
    rows.map((row) => row.map(quote).join(",")).join("\n"),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${survey.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-results.csv"`,
        "Cache-Control": "no-store",
      },
    },
  );
}
