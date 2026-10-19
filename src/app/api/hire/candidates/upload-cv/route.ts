import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
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

  // Upload to Supabase Storage
  const ext = file.name.split(".").pop() ?? "pdf";
  const path = `cvs/${jobId}/${candidateId}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from("kazi-cvs")
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabaseAdmin.storage.from("kazi-cvs").getPublicUrl(path);

  // Extract text — Groq handles plain text; for PDF we send raw bytes as base64
  // For MVP: treat uploaded file as text (Word/PDF text extraction is a later enhancement)
  const cvText = await file.text().catch(() => "");

  // Parse structured fields from CV text
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

  // Update candidate record
  await supabaseAdmin
    .from("candidates")
    .update({ cv_url: urlData.publicUrl, cv_text: cvText || null, cv_parsed: cvParsed })
    .eq("id", candidateId);

  return NextResponse.json({ cv_url: urlData.publicUrl, cv_parsed: cvParsed });
}
