import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertHireCandidateAccess } from "@/lib/hire-company-access";
import { supabaseAdmin } from "@/lib/supabase";
import { resend, EMAIL_FROM } from "@/lib/email";
import sanitizeHtml from "sanitize-html";
import { getHireCompanyBrand } from "@/lib/hire-company-brand";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { candidateId, to, subject, bodyHtml, bodyText } =
    (await req.json()) as {
      candidateId?: string;
      to?: string;
      subject?: string;
      bodyHtml?: string;
      bodyText?: string;
    };
  if (!candidateId || !to || !subject || !bodyHtml || !bodyText) {
    return NextResponse.json(
      { error: "candidateId, recipient, subject and email body required" },
      { status: 400 },
    );
  }

  try {
    await assertHireCandidateAccess({
      candidateId,
      userId: session.user.id,
      userRole: session.user.role,
      minimumRole: "recruiter",
    });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: candidate } = await supabaseAdmin
    .from("candidates")
    .select("email, company_id")
    .eq("id", candidateId)
    .maybeSingle();
  if (!candidate || candidate.email.toLowerCase() !== to.trim().toLowerCase())
    return NextResponse.json(
      { error: "Candidate email does not match" },
      { status: 400 },
    );

  const company = await getHireCompanyBrand(candidate.company_id);
  const sender = company.applicationFromName ?? `${company.displayName} Careers`;

  const safeBody = sanitizeHtml(bodyHtml, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "a"],
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "mailto"],
  }).trim();
  const safeText = bodyText.trim();
  if (!safeBody || !safeText)
    return NextResponse.json(
      { error: "Email body cannot be empty" },
      { status: 400 },
    );

  const { data, error } = await resend.emails.send({
    from: `${sender} <${EMAIL_FROM.match(/<([^>]+)>/)?.[1] ?? EMAIL_FROM}>`,
    to: candidate.email,
    replyTo: company.replyToEmail ?? undefined,
    subject,
    text: safeText,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1e293b;max-width:640px;margin:0 auto">${safeBody}</div>`,
  });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin
    .from("candidates")
    .update({ recruiter_activity_at: new Date().toISOString() })
    .eq("id", candidateId);

  return NextResponse.json({ id: data?.id });
}
