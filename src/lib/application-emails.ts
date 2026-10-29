import { resend, EMAIL_FROM } from "@/lib/email";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** Confirms receipt to the applicant. Failures are logged, never thrown: the application is already saved. */
export async function sendApplicationConfirmation(params: {
  email: string;
  fullName: string;
  jobTitle: string;
}) {
  const firstName = params.fullName.trim().split(/\s+/)[0] ?? "there";
  const role = escapeHtml(params.jobTitle);
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1e293b;max-width:640px;margin:0 auto">
    <p>Hi ${escapeHtml(firstName)},</p>
    <p>Thank you for your interest in joining Growthpad. We have received your application for the <strong>${role}</strong> role, together with your CV.</p>
    <p>Our recruitment team reviews every application and will be in touch if your profile is a good fit. Please don't hesitate to reply to this email if you have questions in the meantime.</p>
    <p>Warm regards,<br />The Growthpad Recruitment Team</p>
  </div>`;
  const text = `Hi ${firstName},\n\nThank you for your interest in joining Growthpad. We have received your application for the ${params.jobTitle} role, together with your CV.\n\nOur recruitment team reviews every application and will be in touch if your profile is a good fit.\n\nWarm regards,\nThe Growthpad Recruitment Team`;

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: params.email,
      subject: `We received your application for ${params.jobTitle}`,
      html,
      text,
    });
    if (error) console.error("Application confirmation email failed", error);
  } catch (error) {
    console.error("Application confirmation email error", error);
  }
}
