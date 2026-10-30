import { deleteFromR2, uploadToR2 } from "@/lib/r2";
import { groq, GROQ_MODEL } from "@/lib/ai";
import { extractCvText } from "@/lib/cv-text";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";
import { redis, SCREENING_QUEUE } from "@/lib/redis";
import { ApplicationError } from "@/lib/application-error";
import { recordAiUsage } from "@/lib/ai-audit";

export const MAX_CV_BYTES = 10 * 1024 * 1024;
const CV_EXTENSIONS = ["pdf", "docx"];

export type ReadCv = {
  bytes: Uint8Array;
  text: string;
  extension: string;
  contentType: string;
};

/** Validates and reads a CV. Throws ApplicationError before anything is stored, so a bad file never creates a candidate. */
export async function readCv(file: File): Promise<ReadCv> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!CV_EXTENSIONS.includes(extension))
    throw new ApplicationError("Please upload a PDF or DOCX CV.", 400);
  if (file.size > MAX_CV_BYTES)
    throw new ApplicationError("CV files must be 10 MB or smaller.", 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  let text = "";
  try {
    // PDF.js (used by unpdf) may transfer/detach the buffer it receives.
    // Keep the original bytes intact because they are the exact bytes we
    // upload to R2 after extraction succeeds.
    text = await extractCvText(file, bytes.slice());
  } catch {
    throw new ApplicationError(
      "We could not read that CV. Please try another PDF or DOCX file.",
      422,
    );
  }
  if (text.length < 50) {
    throw new ApplicationError(
      "We could not find enough readable text in that CV. Please try another PDF or DOCX file.",
      422,
    );
  }
  return {
    bytes,
    text,
    extension,
    contentType: file.type || "application/octet-stream",
  };
}

/** Runs only in the scheduled screening worker, never on an applicant request. */
export async function parseCvText(candidateId: string, cvText: string) {
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
    await recordAiUsage({
      operation: "cv_parse",
      entityType: "candidate",
      entityId: candidateId,
      model: GROQ_MODEL,
      inputCharacters: prompt.length,
      outputCharacters: raw.length,
      tokensUsed: completion.usage?.total_tokens,
    });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Stores a CV that has already been read, parses it, and queues the candidate for screening. */
export async function attachCv(candidateId: string, jobId: string, cv: ReadCv) {
  const key = `cvs/${jobId}/${candidateId}.${cv.extension}`;
  let cvUrl: string;
  try {
    cvUrl = await uploadToR2(key, cv.bytes, cv.contentType);
  } catch (error) {
    throw new ApplicationError(
      error instanceof Error ? error.message : "Upload failed",
      500,
    );
  }

  const { error: candidateUpdateError } = await supabaseAdmin
    .from("candidates")
    .update({ cv_url: cvUrl, cv_text: cv.text || null, cv_parsed: null })
    .eq("id", candidateId);
  if (candidateUpdateError) {
    // A record without an attached CV is never useful. Avoid leaving an
    // orphaned object behind if the database update is rejected.
    try {
      await deleteFromR2(key);
    } catch (cleanupError) {
      console.error("Could not remove orphaned CV after database failure", cleanupError);
    }
    throw new ApplicationError("Could not attach the uploaded CV", 500);
  }

  // A later worker sweep catches this candidate if Redis is briefly unavailable.
  let queuedForScreening = false;
  try {
    await redis.rpush(SCREENING_QUEUE, candidateId);
    queuedForScreening = true;
  } catch (error) {
    console.error("Could not enqueue candidate for screening", error);
  }

  await invalidateTables("candidates");
  return { cvUrl, queuedForScreening };
}
