import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  assertHireJobAccess,
  canManageHireCompany,
  getHireCompanyAccess,
} from "@/lib/hire-company-access";
import { supabaseAdmin } from "@/lib/supabase";
import { groq, GROQ_MODEL } from "@/lib/ai";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canDraft = (
    await getHireCompanyAccess(session.user.id, session.user.role)
  ).some((access) => canManageHireCompany(access.role));
  if (!canDraft)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, department, brief, jobId } = await req.json();
  if (!title || !brief) {
    return NextResponse.json(
      { error: "title and brief are required" },
      { status: 400 },
    );
  }
  if (typeof jobId === "string" && jobId) {
    try {
      await assertHireJobAccess({
        jobId,
        userId: session.user.id,
        userRole: session.user.role,
        minimumRole: "hiring_manager",
      });
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const prompt = `You are an HR specialist at Growthpad Consulting Group, a Nairobi-based communications, technology and digital services firm.

Draft a clear, professional job description for the following role. Write for a Kenyan/East African audience. Be specific about responsibilities. Do NOT pad with generic filler.

Role: ${title}
Department: ${department || "Growthpad"}
Brief from hiring manager: ${brief}

Return ONLY the job description text, no preamble. Structure: Overview (2–3 sentences), Key Responsibilities (bulleted), What We're Looking For (bulleted), What We Offer (2–3 bullets). Keep it under 400 words.`;

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1024,
  });

  const text = completion.choices[0]?.message?.content ?? "";

  if (jobId) {
    await supabaseAdmin.from("ai_logs").insert({
      operation: "jd_draft",
      entity_type: "job",
      entity_id: jobId,
      model: GROQ_MODEL,
      prompt,
      response: text,
      tokens_used: completion.usage?.total_tokens ?? null,
    });
  }

  return NextResponse.json({ description: text });
}
