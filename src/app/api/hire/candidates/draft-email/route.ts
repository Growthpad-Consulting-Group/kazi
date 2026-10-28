import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { groq, GROQ_MODEL } from "@/lib/ai";
import { recordAiUsage } from "@/lib/ai-audit";

type EmailType = "acknowledgement" | "invite" | "rejection" | "acceptance";

const TEMPLATES: Record<EmailType, string> = {
  acknowledgement: "Thank the candidate for applying, confirm receipt, and let them know they'll hear back within 5–7 business days.",
  invite: "Invite the candidate for an interview. Be warm and professional. Ask them to confirm their availability by replying to this email.",
  rejection: "Decline the candidate respectfully. Thank them for their time and interest. Encourage them to apply to future roles. Do not reveal AI was used in screening decisions.",
  acceptance: "Congratulate the candidate on being selected to move forward. Explain that the team will share next steps shortly and invite them to reply with any questions.",
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_hiring")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { candidateId, type } = await req.json() as { candidateId: string; type: EmailType };
  if (!candidateId || !type || !TEMPLATES[type]) {
    return NextResponse.json({ error: "candidateId and type required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("candidates")
    .select("full_name, email, jobs(title)")
    .eq("id", candidateId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const candidate = data as unknown as {
    full_name: string;
    email: string;
    jobs: { title: string } | null;
  };

  const prompt = `You are an HR coordinator at Growthpad Consulting Group writing a professional recruitment email.

Candidate: ${candidate.full_name}
Role: ${candidate.jobs?.title ?? "the role"}
Email type: ${type}
Task: ${TEMPLATES[type]}

Write a short, warm, professional email. Use the candidate's first name. Sign off as "The Growthpad Recruitment Team".

Return ONLY valid JSON:
{
  "subject": "string",
  "body": "string (plain text, use \\n for line breaks)"
}`;

  let completion;
  try {
    completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 512,
      response_format: { type: "json_object" },
    });
  } catch (error) {
    console.error("Email drafting request failed", error);
    return NextResponse.json(
      { error: "AI drafting is temporarily unavailable. Please try again shortly." },
      { status: 502 }
    );
  }

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let result: { subject: string; body: string };
  try {
    result = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
  }

  await recordAiUsage({
    operation: "email_draft",
    entityType: "candidate",
    entityId: candidateId,
    model: GROQ_MODEL,
    inputCharacters: prompt.length,
    outputCharacters: raw.length,
    tokensUsed: completion.usage?.total_tokens,
  });

  return NextResponse.json({ ...result, to: candidate.email, candidateName: candidate.full_name });
}
