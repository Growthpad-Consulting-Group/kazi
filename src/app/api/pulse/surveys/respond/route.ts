import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { surveyId, answers, respondentId } = await req.json();
  if (!surveyId || !answers) return NextResponse.json({ error: "surveyId and answers required" }, { status: 400 });

  // Check survey is active
  const { data: survey } = await supabaseAdmin.from("surveys").select("status, anonymous").eq("id", surveyId).single();
  if (!survey || (survey as unknown as { status: string }).status !== "active") {
    return NextResponse.json({ error: "Survey is not active" }, { status: 400 });
  }

  // Prevent duplicate responses
  const { data: existing } = await supabaseAdmin
    .from("survey_responses")
    .select("id")
    .eq("survey_id", surveyId)
    .eq("respondent_id", session.user.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "Already responded" }, { status: 409 });

  const { error } = await supabaseAdmin.from("survey_responses").insert({
    survey_id: surveyId,
    respondent_id: (survey as unknown as { anonymous: boolean }).anonymous ? null : session.user.id,
    answers,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
