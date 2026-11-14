import { NextResponse } from "next/server";
import { createCandidateUploadToken } from "@/lib/candidate-upload-token";
import { ApplicationError } from "@/lib/application-error";
import {
  assertCanApply,
  assertCanApplyByPublicReference,
  insertApplicant,
  notifyNewApplicant,
} from "@/lib/candidate-applications";
import { sendApplicationConfirmation } from "@/lib/application-emails";
import { getHireCompanyBrand } from "@/lib/hire-company-brand";
import { checkRateLimit, rateLimitHeaders, requestIp } from "@/lib/rate-limit";
import {
  normalizeApplicationUrl,
  normalizeLinkedInProfile,
} from "@/lib/application-urls";

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
    job_slug,
    company_slug,
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

  if (
    (!job_id && !(job_slug && company_slug)) ||
    !full_name ||
    !email ||
    !consented
  ) {
    return NextResponse.json(
      { error: "A job reference, full_name, email and consent are required" },
      { status: 400 },
    );
  }
  const linkedinUrl = normalizeLinkedInProfile(linkedin_url);
  const portfolioUrl = portfolio_url
    ? normalizeApplicationUrl(portfolio_url)
    : null;
  if (!linkedinUrl) {
    return NextResponse.json(
      { error: "A valid LinkedIn profile URL is required" },
      { status: 400 },
    );
  }
  if (portfolio_url && !portfolioUrl)
    return NextResponse.json(
      { error: "Enter a valid portfolio or website URL" },
      { status: 400 },
    );

  try {
    const job = job_id
      ? await assertCanApply(job_id, email)
      : await assertCanApplyByPublicReference(
          { companySlug: company_slug, jobSlug: job_slug },
          email,
        );
    const resolvedJobId = job_id ?? job.id;
    const candidateId = await insertApplicant({
      job_id: resolvedJobId,
      full_name,
      email,
      phone,
      location,
      linkedin_url: linkedinUrl,
      portfolio_url: portfolioUrl,
      cover_message,
      source,
    });
    await notifyNewApplicant(candidateId, { full_name }, job);
    await sendApplicationConfirmation({
      email,
      fullName: full_name,
      jobTitle: job.title,
      company: await getHireCompanyBrand(job.company_id),
    });
    return NextResponse.json({
      candidateId,
      uploadToken: createCandidateUploadToken(candidateId, resolvedJobId),
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
