import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";
import { uploadToR2 } from "@/lib/r2";
import { groq, GROQ_MODEL } from "@/lib/ai";
import { verifyCandidateUploadToken } from "@/lib/candidate-upload-token";
import { extractCvText } from "@/lib/cv-text";
import { redis, SCREENING_QUEUE } from "@/lib/redis";

export const runtime = "nodejs";
const MAX_CV_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const formData = await req.formData();
  const file = formData.get("cv") as File | null;
  const candidateId = formData.get("candidateId") as string;
  const jobId = formData.get("jobId") as string;
  const uploadToken = formData.get("uploadToken") as string | null;

  if (!file || !candidateId || !jobId) {
    return NextResponse.json({ error: "cv, candidateId, jobId required" }, { status: 400 });
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["pdf", "docx"].includes(extension)) {
    return NextResponse.json({ error: "Please upload a PDF or DOCX CV." }, { status: 400 });
  }
  if (file.size > MAX_CV_BYTES) {
    return NextResponse.json({ error: "CV files must be 10 MB or smaller." }, { status: 400 });
  }

  const hasPublicUploadAuthority = verifyCandidateUploadToken(uploadToken, candidateId, jobId);
  if (!session && !hasPublicUploadAuthority) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (session && !hasPublicUploadAuthority && !can(session.user.role, "manage_hiring")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: candidate } = await supabaseAdmin
    .from("candidates")
    .select("id")
    .eq("id", candidateId)
    .eq("job_id", jobId)
    .maybeSingle();
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

  // Upload to Cloudflare R2
  const ext = extension;
  const key = `cvs/${jobId}/${candidateId}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  // Reject unreadable files before storing them, so applicants can correct the upload.
  let cvText = "";
  try {
    cvText = await extractCvText(file, bytes);
  } catch {
    return NextResponse.json({ error: "We could not read that CV. Please try another PDF or DOCX file." }, { status: 422 });
  }
  if (cvText.length < 50) {
    return NextResponse.json({ error: "We could not find enough readable text in that CV. Please try another PDF or DOCX file." }, { status: 422 });
  }

  let cvUrl: string;
  try {
    cvUrl = await uploadToR2(key, bytes, file.type || "application/octet-stream");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Parse structured fields from CV text via Groq
  let cvParsed = null;
  if (cvText.length > 50) {
    const prompt = `Extract structured information from this CV text. Return ONLY valid JSON, no explanation.

CV:
${cvText.slice(0, 6000)}

Return this exact JSON shape:
{
  "experience": [{"title": "string", "company": "string", "duration": "string"}],
  "skills": ["string"],
  "education": [{"degree": "string", "institution": "string", "year": "string"}]
}`;

    try {
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        response_format: { type: "json_object" },
      });
      const raw = completion.choices[0]?.message?.content ?? "{}";
      cvParsed = JSON.parse(raw);

      await supabaseAdmin.from("ai_logs").insert({
        operation: "cv_parse",
        entity_type: "candidate",
        entity_id: candidateId,
        model: GROQ_MODEL,
        prompt,
        response: raw,
        tokens_used: completion.usage?.total_tokens ?? null,
      });
    } catch {
      cvParsed = null;
    }
  }

  await supabaseAdmin
    .from("candidates")
    .update({ cv_url: cvUrl, cv_text: cvText || null, cv_parsed: cvParsed })
    .eq("id", candidateId);

  // A later worker sweep catches this candidate if Redis is briefly unavailable.
  // Do not tell an applicant their CV upload failed after R2 and Supabase succeeded.
  let queuedForScreening = false;
  if (cvText || cvParsed) {
    try {
      await redis.rpush(SCREENING_QUEUE, candidateId);
      queuedForScreening = true;
    } catch (error) {
      console.error("Could not enqueue candidate for screening", error);
    }
  }

  // The candidate's CV changed — the cached pipeline entry is now stale.
  await invalidateTables("candidates");

  return NextResponse.json({ cv_url: cvUrl, cv_parsed: cvParsed, queuedForScreening });
}
