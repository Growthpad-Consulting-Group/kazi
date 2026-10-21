import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/gmail.settings.basic"];

export async function pushSignatureToGmail(staffEmail: string, html: string) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("Gmail service-account credentials are not configured.");
  if (html.length > 10_000) throw new Error("This signature exceeds Gmail’s 10,000-character limit.");
  const auth = new google.auth.JWT({ email, key, scopes: SCOPES, subject: staffEmail });
  const gmail = google.gmail({ version: "v1", auth });
  await gmail.users.settings.sendAs.patch({ userId: "me", sendAsEmail: staffEmail, requestBody: { signature: html } });
}
