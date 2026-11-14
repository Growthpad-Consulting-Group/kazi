import { NextResponse } from "next/server";
import { ApplicationError } from "@/lib/application-error";
import { readCv, attachCv } from "@/lib/candidate-cv";
import {
  assertCanApply,
  assertCanApplyByPublicReference,
  insertApplicant,
  deleteApplicant,
  notifyNewApplicant,
} from "@/lib/candidate-applications";
import { sendApplicationConfirmation } from "@/lib/application-emails";
import { getHireCompanyBrand } from "@/lib/hire-company-brand";
import { checkRateLimit, rateLimitHeaders, requestIp } from "@/lib/rate-limit";
import {
  normalizeApplicationUrl,
  normalizeLinkedInProfile,
} from "@/lib/application-urls";

export const runtime = "nodejs";

// Public endpoint: a single request carries the applicant's details and CV.
// The CV is read before any candidate record is created, so an unreadable file never leaves a half-saved application.
export async function POST(req: Request) {
  const limit = await checkRateLimit({
    scope: "application-cv",
    identifier: requestIp(req.headers),
    limit: 4,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Too many application attempts. Please try again later." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  const form = await req.formData();
  const field = (key: string) =>
    typeof form.get(key) === "string"
      ? (form.get(key) as string).trim() || null
      : null;
  const jobId = field("job_id");
  const jobSlug = field("job_slug");
  const companySlug = field("company_slug");
  const fullName = field("full_name");
  const email = field("email");
  const cv = form.get("cv");

  if (
    (!jobId && !(jobSlug && companySlug)) ||
    !fullName ||
    !email ||
    form.get("consented") !== "true"
  ) {
    return NextResponse.json(
      {
        error: "A job reference, full_name, email and consent are required",
      },
      { status: 400 },
    );
  }
  if (!(cv instanceof File))
    return NextResponse.json(
      { error: "Please upload your CV." },
      { status: 400 },
    );
  const linkedinUrl = normalizeLinkedInProfile(field("linkedin_url"));
  const portfolioUrl = field("portfolio_url")
    ? normalizeApplicationUrl(field("portfolio_url"))
    : null;
  if (!linkedinUrl)
    return NextResponse.json(
      { error: "A valid LinkedIn profile URL is required" },
      { status: 400 },
    );
  if (field("portfolio_url") && !portfolioUrl)
    return NextResponse.json(
      { error: "Enter a valid portfolio or website URL" },
      { status: 400 },
    );

  try {
    const job = jobId
      ? await assertCanApply(jobId, email)
      : await assertCanApplyByPublicReference(
          { companySlug: companySlug!, jobSlug: jobSlug! },
          email,
        );
    const resolvedJobId = jobId ?? job.id;
    const readable = await readCv(cv);

    const candidateId = await insertApplicant({
      job_id: resolvedJobId,
      full_name: fullName,
      email,
      phone: field("phone"),
      linkedin_url: linkedinUrl,
      portfolio_url: portfolioUrl,
      cover_message: field("cover_message"),
      source: field("source") ?? "website",
    });

    try {
      const stored = await attachCv(candidateId, resolvedJobId, readable);
      await notifyNewApplicant(candidateId, { full_name: fullName }, job);
      await sendApplicationConfirmation({
        email,
        fullName,
        jobTitle: job.title,
        company: await getHireCompanyBrand(job.company_id),
      });
      return NextResponse.json({
        candidateId,
        queuedForScreening: stored.queuedForScreening,
      });
    } catch (error) {
      // Don't leave an applicant without a CV: remove the record so they can retry cleanly.
      await deleteApplicant(candidateId);
      throw error;
    }
  } catch (error) {
    if (error instanceof ApplicationError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error("Application with CV failed", error);
    return NextResponse.json(
      { error: "We could not submit your application. Please try again." },
      { status: 500 },
    );
  }
}
