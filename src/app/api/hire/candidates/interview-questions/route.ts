import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { groq, GROQ_MODEL } from "@/lib/ai";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "hr", "hiring_manager", "interviewer"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { candidateId } = await req.json();
  if (!candidateId) return NextResponse.json({ error: "candidateId required" }, { status: 400 });

  type CandidateWithJob = {
    cv_parsed: unknown;
    cv_text: string | null;
    jobs: {
      title: string;
      description: string | null;
      requirements: { must_haves: string[]; nice_to_haves: string[] };
      scoring_rubric: { criterion: string; weight: number; description: string }[];
    } | null;
  };

  const { data, error } = await supabaseAdmin
    .from("candidates")
    .select("*, jobs(title, description, requirements, scoring_rubric)")
    .eq("id", candidateId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const candidate = data as unknown as CandidateWithJob;

  const job = candidate.jobs;
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const cvSummary = candidate.cv_parsed
    ? JSON.stringify(candidate.cv_parsed)
    : candidate.cv_text?.slice(0, 3000) ?? "No CV available";

  const prompt = `You are a senior recruiter preparing an interview for a candidate at Growthpad Consulting Group.

Role: ${job.title}
Must-haves: ${job.requirements.must_haves.join(", ") || "None specified"}
Scoring criteria: ${job.scoring_rubric.map((r: { criterion: string }) => r.criterion).join(", ") || "General fit"}
Anonymised candidate background: ${cvSummary}

Generate 8 structured interview questions tailored to this role and candidate background. Mix behavioural, technical and situational questions. Do not include questions that reveal you know the candidate's name or personal details.

Return ONLY valid JSON:
{
  "questions": [
    {
      "question": "string",
      "type": "behavioural | technical | situational | culture",
      "criterion": "string (which rubric criterion this tests)",
      "guidance": "string (what a strong answer looks like, 1 sentence)"
    }
  ]
}`;

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2048,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let result: { questions: { question: string; type: string; criterion: string; guidance: string }[] };
  try {
    result = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
  }

  await supabaseAdmin.from("ai_logs").insert({
    operation: "interview_questions",
    entity_type: "candidate",
    entity_id: candidateId,
    model: GROQ_MODEL,
    prompt,
    response: raw,
    tokens_used: completion.usage?.total_tokens ?? null,
  });

  return NextResponse.json(result);
}
