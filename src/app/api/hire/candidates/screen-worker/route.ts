import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { groq, GROQ_MODEL } from "@/lib/ai";
import { redis, SCREENING_QUEUE, SCREENING_PROCESSING } from "@/lib/redis";
import { invalidateTables } from "@/lib/cache/invalidate";
import { recordAiUsage } from "@/lib/ai-audit";
import { hasCronAccess } from "@/lib/cron-auth";
import { parseCvText } from "@/lib/candidate-cv";
import type { CandidateStage } from "@/types/database";

// Called by Vercel Cron (vercel.json) or an external scheduler.
// Processes up to BATCH_SIZE candidates per invocation.
// Secured with CRON_SECRET so it cannot be triggered by anonymous requests.

const BATCH_SIZE = 5;

type CandidateWithJob = {
  id: string;
  ai_score: number | null;
  stage: CandidateStage;
  cv_text: string | null;
  cv_parsed: unknown;
  jobs: {
    title: string;
    requirements: { must_haves: string[]; nice_to_haves: string[] };
    scoring_rubric: {
      criterion: string;
      weight: number;
      description: string;
    }[];
  } | null;
};

async function screenOne(candidateId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("candidates")
    .select(
      "id, ai_score, stage, cv_text, cv_parsed, jobs(title, requirements, scoring_rubric)",
    )
    .eq("id", candidateId)
    .single();

  if (error || !data) return;
  const candidate = data as unknown as CandidateWithJob;
  const job = candidate.jobs;
  if (!job || candidate.ai_score !== null) return;

  const parsedCv =
    candidate.cv_parsed ??
    (candidate.cv_text
      ? await parseCvText(candidateId, candidate.cv_text)
      : null);
  if (!candidate.cv_parsed && parsedCv) {
    await supabaseAdmin
      .from("candidates")
      .update({ cv_parsed: parsedCv })
      .eq("id", candidateId);
  }

  const cvData = parsedCv
    ? JSON.stringify(parsedCv)
    : (candidate.cv_text?.slice(0, 6000) ?? "");
  if (!cvData) return;

  const rubric = job.scoring_rubric ?? [];
  const requirements = job.requirements ?? {
    must_haves: [],
    nice_to_haves: [],
  };
  const rubricText = rubric.length
    ? rubric
        .map((r) => `- ${r.criterion} (${r.weight}%): ${r.description}`)
        .join("\n")
    : "General fit for the role";

  const prompt = `You are a fair, unbiased recruitment assistant screening a candidate for a role. Anonymised CV data (no name, photo, age, gender or personal identifiers).

Role: ${job.title}

Must-haves:
${requirements.must_haves.map((r) => `- ${r}`).join("\n") || "None specified"}

Scoring rubric:
${rubricText}

Anonymised CV:
${cvData}

Score 0–100. Shortlist if ≥ 65. Return ONLY valid JSON:
{"score": number, "justification": "string", "shortlisted": boolean}`;

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
    throw new Error("AI returned invalid screening JSON");
  }

  await Promise.all([
    supabaseAdmin
      .from("candidates")
      .update({
        ai_score: result.score,
        ai_justification: result.justification,
        shortlisted: result.shortlisted,
        // Automation only advances a fresh application. It never rewinds a
        // stage that a recruiter has already moved forward.
        stage: candidate.stage === "applied" ? "screened" : candidate.stage,
      })
      .eq("id", candidateId),

    recordAiUsage({
      operation: "screening_queue",
      entityType: "candidate",
      entityId: candidateId,
      model: GROQ_MODEL,
      inputCharacters: prompt.length,
      outputCharacters: raw.length,
      tokensUsed: completion.usage?.total_tokens,
    }),
  ]);

  // The candidate's stage, score and shortlist flag all changed — drop the
  // cached pipeline and dashboard aggregates so the change is visible at once.
  await invalidateTables("candidates");
}

export async function GET(req: Request) {
  if (!hasCronAccess(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const queuedIds: string[] = [];
  for (let i = 0; i < BATCH_SIZE; i++) {
    const id = await redis.lpop<string>(SCREENING_QUEUE);
    if (!id) break;
    queuedIds.push(id);
  }

  // The worker also catches legacy and imported applications, so the feature
  // does not rely on an HR user remembering to press a "screen" button.
  if (queuedIds.length < BATCH_SIZE) {
    const { data: backlog } = await supabaseAdmin
      .from("candidates")
      .select("id")
      .is("ai_score", null)
      .or("cv_text.not.is.null,cv_parsed.not.is.null")
      .limit(BATCH_SIZE - queuedIds.length);
    for (const candidate of backlog ?? []) {
      if (!queuedIds.includes(candidate.id)) queuedIds.push(candidate.id);
    }
  }

  const processed: string[] = [];
  const failed: string[] = [];

  for (const id of queuedIds) {
    // Track in-progress candidates for operational visibility.
    await redis.sadd(SCREENING_PROCESSING, id);
    try {
      await screenOne(id);
      processed.push(id);
    } catch {
      failed.push(id);
      // Re-queue failed items at the back so they don't block the queue
      await redis.rpush(SCREENING_QUEUE, id);
    } finally {
      await redis.srem(SCREENING_PROCESSING, id);
    }
  }

  const remaining = await redis.llen(SCREENING_QUEUE);

  return NextResponse.json({
    processed: processed.length,
    failed: failed.length,
    remaining,
  });
}
