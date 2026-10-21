import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { resend, EMAIL_FROM } from "@/lib/email";
import sanitizeHtml from "sanitize-html";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "hr")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { to, subject, bodyHtml, bodyText } = await req.json() as { to?: string; subject?: string; bodyHtml?: string; bodyText?: string };
  if (!to || !subject || !bodyHtml || !bodyText) {
    return NextResponse.json({ error: "to, subject, email body required" }, { status: 400 });
  }

  const safeBody = sanitizeHtml(bodyHtml, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "a"],
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "mailto"],
  }).trim();
  const safeText = bodyText.trim();
  if (!safeBody || !safeText) return NextResponse.json({ error: "Email body cannot be empty" }, { status: 400 });

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    text: safeText,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1e293b;max-width:640px;margin:0 auto">${safeBody}</div>`,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data?.id });
}
