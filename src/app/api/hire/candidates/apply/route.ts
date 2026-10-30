import { NextResponse } from "next/server";
import { createCandidateUploadToken } from "@/lib/candidate-upload-token";
import { ApplicationError } from "@/lib/application-error";
import { assertCanApply, insertApplicant } from "@/lib/candidate-applications";
import { sendApplicationConfirmation } from "@/lib/application-emails";
import { checkRateLimit, rateLimitHeaders, requestIp } from "@/lib/rate-limit";

function isLinkedInProfile(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      (url.hostname === "linkedin.com" ||
        url.hostname.endsWith(".linkedin.com"))
    );
  } catch {
    return false;
  }
}

// Public endpoint: creates the application without a CV. Prefer apply-with-cv, which reads the CV first.
export async function POST(req: Request) {
  const limit = await checkRateLimit({
    scope: "application",
    identifier: requestIp(req.headers),
    limit: 8,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Too many application attempts. Please try again later." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  const body = await req.json();
  const {
    job_id,
    full_name,
    email,
    phone,
    location,
    linkedin_url,
    portfolio_url,
    cover_message,
    source,
    consented,
  } = body;

  if (!job_id || !full_name || !email || !consented) {
    return NextResponse.json(
      { error: "job_id, full_name, email and consent are required" },
      { status: 400 },
    );
  }
  if (!isLinkedInProfile(linkedin_url)) {
    return NextResponse.json(
      { error: "A valid LinkedIn profile URL is required" },
      { status: 400 },
    );
  }

  try {
    const job = await assertCanApply(job_id, email);
    const candidateId = await insertApplicant(
      {
        job_id,
        full_name,
        email,
        phone,
        location,
        linkedin_url,
        portfolio_url,
        cover_message,
        source,
      },
      job,
    );
    await sendApplicationConfirmation({
      email,
      fullName: full_name,
      jobTitle: job.title,
    });
    return NextResponse.json({
      candidateId,
      uploadToken: createCandidateUploadToken(candidateId, job_id),
    });
  } catch (error) {
    if (error instanceof ApplicationError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    throw error;
  }
}
