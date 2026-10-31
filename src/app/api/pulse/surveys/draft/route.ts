import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { isSurveyAudienceMember } from "@/features/pulse/surveys/audience";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const surveyId = new URL(req.url).searchParams.get("surveyId");
  if (!session || !surveyId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed drafts table
  const { data } = await (supabaseAdmin as any)
    .from("survey_response_drafts")
    .select("answers")
    .eq("survey_id", surveyId)
    .eq("user_id", session.user.id)
    .maybeSingle();
  return NextResponse.json({ answers: data?.answers ?? {} });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  const body = (await req.json().catch(() => null)) as {
    surveyId?: unknown;
    answers?: unknown;
  } | null;
  if (
    !session ||
    typeof body?.surveyId !== "string" ||
    !body.answers ||
    typeof body.answers !== "object" ||
    Array.isArray(body.answers)
  )
    return NextResponse.json({ error: "Invalid draft." }, { status: 400 });
  if (!(await isSurveyAudienceMember(body.surveyId, session.user.id)))
    return NextResponse.json(
      { error: "This survey is not available to you." },
      { status: 403 },
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed drafts table
  const { error } = await (supabaseAdmin as any)
    .from("survey_response_drafts")
    .upsert({
      survey_id: body.surveyId,
      user_id: session.user.id,
      answers: body.answers,
      updated_at: new Date().toISOString(),
    });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
