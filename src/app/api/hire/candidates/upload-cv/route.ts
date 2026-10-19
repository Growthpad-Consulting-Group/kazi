import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { uploadToR2 } from "@/lib/r2";
import { groq, GROQ_MODEL } from "@/lib/ai";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("cv") as File | null;
  const candidateId = formData.get("candidateId") as string;
  const jobId = formData.get("jobId") as string;

  if (!file || !candidateId || !jobId) {
    return NextResponse.json({ error: "cv, candidateId, jobId required" }, { status: 400 });
  }

  // Upload to Cloudflare R2
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
  const key = `cvs/${jobId}/${candidateId}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  let cvUrl: string;
  try {
    cvUrl = await uploadToR2(key, bytes, file.type || "application/octet-stream");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Extract text for AI parsing (works for plain-text CVs; PDF/Word text extraction is a Phase 2 enhancement)
  const cvText = await file.text().catch(() => "");

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

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    try {
      cvParsed = JSON.parse(raw);
    } catch {
      cvParsed = null;
    }

    await supabaseAdmin.from("ai_logs").insert({
      operation: "cv_parse",
      entity_type: "candidate",
      entity_id: candidateId,
      model: GROQ_MODEL,
      prompt,
      response: raw,
      tokens_used: completion.usage?.total_tokens ?? null,
    });
  }

  await supabaseAdmin
    .from("candidates")
    .update({ cv_url: cvUrl, cv_text: cvText || null, cv_parsed: cvParsed })
    .eq("id", candidateId);

  return NextResponse.json({ cv_url: cvUrl, cv_parsed: cvParsed });
}
