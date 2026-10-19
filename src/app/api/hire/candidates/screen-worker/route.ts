import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { groq, GROQ_MODEL } from "@/lib/ai";
import { redis, SCREENING_QUEUE, SCREENING_PROCESSING } from "@/lib/redis";

// Called by Vercel Cron (vercel.json) or an external scheduler.
// Processes up to BATCH_SIZE candidates per invocation.
// Secured with CRON_SECRET so it cannot be triggered by anonymous requests.

const BATCH_SIZE = 5;

type CandidateWithJob = {
  id: string;
  cv_text: string | null;
  cv_parsed: unknown;
  jobs: {
    title: string;
    requirements: { must_haves: string[]; nice_to_haves: string[] };
    scoring_rubric: { criterion: string; weight: number; description: string }[];
  } | null;
};

async function screenOne(candidateId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("candidates")
    .select("id, cv_text, cv_parsed, jobs(title, requirements, scoring_rubric)")
    .eq("id", candidateId)
    .single();

  if (error || !data) return;
  const candidate = data as unknown as CandidateWithJob;
  const job = candidate.jobs;
  if (!job) return;

  const cvData = candidate.cv_parsed
    ? JSON.stringify(candidate.cv_parsed)
    : (candidate.cv_text?.slice(0, 6000) ?? "");
  if (!cvData) return;

  const rubricText = job.scoring_rubric.length
    ? job.scoring_rubric.map((r) => `- ${r.criterion} (${r.weight}%): ${r.description}`).join("\n")
    : "General fit for the role";

  const prompt = `You are a fair, unbiased recruitment assistant screening a candidate for a role. Anonymised CV data (no name, photo, age, gender or personal identifiers).

Role: ${job.title}

Must-haves:
${job.requirements.must_haves.map((r) => `- ${r}`).join("\n") || "None specified"}

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
    return;
  }

  await Promise.all([
    supabaseAdmin.from("candidates").update({
      ai_score: result.score,
      ai_justification: result.justification,
      shortlisted: result.shortlisted,
      stage: "screened",
    }).eq("id", candidateId),

    supabaseAdmin.from("ai_logs").insert({
      operation: "screening_queue",
      entity_type: "candidate",
      entity_id: candidateId,
      model: GROQ_MODEL,
      prompt,
      response: raw,
      tokens_used: completion.usage?.total_tokens ?? null,
    }),
  ]);
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const processed: string[] = [];
  const failed: string[] = [];

  for (let i = 0; i < BATCH_SIZE; i++) {
    // LPOP + track in processing set for visibility
    const id = await redis.lpop<string>(SCREENING_QUEUE);
    if (!id) break;

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

  return NextResponse.json({ processed: processed.length, failed: failed.length, remaining });
}
