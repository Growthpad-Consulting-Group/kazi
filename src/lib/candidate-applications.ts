import { supabaseAdmin } from "@/lib/supabase";
import { notifyRoles, RECRUITER_ROLES } from "@/lib/notifications";
import { invalidateTables } from "@/lib/cache/invalidate";
import { ApplicationError } from "@/lib/application-error";

export type ApplicationInput = {
  job_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  location?: string | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
  cover_message?: string | null;
  source?: string | null;
};

/** Confirms the role is open for applications and this email hasn't already applied. Throws ApplicationError-style status errors. */
export async function assertCanApply(jobId: string, email: string) {
  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id, status, title, published_at, closes_at")
    .eq("id", jobId)
    .single();

  const now = new Date();
  if (
    !job ||
    job.status !== "open" ||
    (job.published_at && new Date(job.published_at) > now) ||
    (job.closes_at && new Date(job.closes_at) <= now)
  ) {
    throw new ApplicationError("This role is not accepting applications", 404);
  }

  const { data: existing } = await supabaseAdmin
    .from("candidates")
    .select("id")
    .eq("job_id", jobId)
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (existing)
    throw new ApplicationError(
      "An application with this email already exists for this role",
      409,
    );

  return job;
}

export async function insertApplicant(input: ApplicationInput) {
  const { data: candidate, error } = await supabaseAdmin
    .from("candidates")
    .insert({
      job_id: input.job_id,
      full_name: input.full_name,
      email: input.email.toLowerCase(),
      phone: input.phone || null,
      location: input.location || null,
      linkedin_url: input.linkedin_url || null,
      portfolio_url: input.portfolio_url || null,
      cover_message: input.cover_message || null,
      source: input.source || "direct",
      consented_at: new Date().toISOString(),
      applied_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new ApplicationError(error.message, 500);

  await invalidateTables("candidates");
  return candidate.id as string;
}

/** Notify recruiters only once an application is fully persisted. */
export async function notifyNewApplicant(
  candidateId: string,
  input: Pick<ApplicationInput, "full_name">,
  job: { title: string },
) {
  await notifyRoles(
    RECRUITER_ROLES,
    `New application: ${input.full_name} for ${job.title}`,
    `/hire/candidates/${candidateId}`,
  );
}

export async function deleteApplicant(candidateId: string) {
  await supabaseAdmin.from("candidates").delete().eq("id", candidateId);
}
