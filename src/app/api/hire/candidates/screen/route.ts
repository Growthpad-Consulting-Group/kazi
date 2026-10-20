import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";
import { groq, GROQ_MODEL } from "@/lib/ai";
import type { Candidate } from "@/types/database";

type CandidateWithJobData = Candidate & {
  jobs: {
    title: string;
    requirements: { must_haves: string[]; nice_to_haves: string[] };
    scoring_rubric: { criterion: string; weight: number; description: string }[];
  } | null;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "hr")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { candidateId } = await req.json();
  if (!candidateId) return NextResponse.json({ error: "candidateId required" }, { status: 400 });

  const { data, error: cErr } = await supabaseAdmin
    .from("candidates")
    .select("*, jobs(title, requirements, scoring_rubric)")
    .eq("id", candidateId)
    .single();

  if (cErr || !data) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

  const candidate = data as unknown as CandidateWithJobData;
  const job = candidate.jobs;

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (!candidate.cv_text && !candidate.cv_parsed) {
    return NextResponse.json({ error: "No CV data to screen" }, { status: 400 });
  }

  // Anonymise before sending to AI
  const cvData = candidate.cv_parsed
    ? JSON.stringify(candidate.cv_parsed)
    : (candidate.cv_text?.slice(0, 6000) ?? "");

  const rubricText = job.scoring_rubric.length
    ? job.scoring_rubric.map((r) => `- ${r.criterion} (${r.weight}%): ${r.description}`).join("\n")
    : "General fit for the role";

  const prompt = `You are a fair, unbiased recruitment assistant. You are screening a candidate for a role. You have been given anonymised CV data (no name, photo, age, gender or personal identifiers).

Role: ${job.title}

Must-haves:
${job.requirements.must_haves.map((r) => `- ${r}`).join("\n") || "None specified"}

Scoring rubric (criteria and weights):
${rubricText}

Anonymised CV data:
${cvData}

Score this candidate from 0–100 based ONLY on the rubric and must-haves. Write a concise justification (3–5 sentences) citing specific evidence from the CV. Do not guess at or infer personal characteristics.

Return ONLY valid JSON:
{
  "score": number,
  "justification": "string",
  "shortlisted": boolean
}

Shortlist if score >= 65.`;

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 512,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let result: { score: number; justification: string; shortlisted: boolean };
  try {
    result = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
  }

  await supabaseAdmin
    .from("candidates")
    .update({
      ai_score: result.score,
      ai_justification: result.justification,
      shortlisted: result.shortlisted,
      stage: "screened",
    })
    .eq("id", candidateId);

  // Screening changed the candidate's score, shortlist flag and stage.
  await invalidateTables("candidates");

  await supabaseAdmin.from("ai_logs").insert({
    operation: "screening",
    entity_type: "candidate",
    entity_id: candidateId,
    model: GROQ_MODEL,
    prompt,
    response: raw,
    tokens_used: completion.usage?.total_tokens ?? null,
  });

  return NextResponse.json(result);
}
