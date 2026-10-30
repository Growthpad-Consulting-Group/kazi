import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { ApplyPage } from "@/features/hire/candidates/components/ApplyPage";

export default async function PublicApplyPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;

  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select(
      "id, title, department, location, description, requirements, employment_type, work_mode, contract_duration, compensation, reports_to, benefits, application_instructions, selection_process, status, published_at, closes_at",
    )
    .eq("id", jobId)
    .single();

  const now = new Date();
  if (
    !job ||
    job.status !== "open" ||
    (job.published_at && new Date(job.published_at) > now) ||
    (job.closes_at && new Date(job.closes_at) <= now)
  )
    notFound();

  return (
    <ApplyPage
      job={{
        id: job.id,
        title: job.title,
        department: job.department,
        location: job.location,
        description: job.description,
        requirements: job.requirements as {
          must_haves?: string[];
          nice_to_haves?: string[];
        } | null,
        employmentType: job.employment_type,
        workMode: job.work_mode,
        contractDuration: job.contract_duration,
        compensation: job.compensation,
        reportsTo: job.reports_to,
        benefits: job.benefits,
        applicationInstructions: job.application_instructions,
        selectionProcess: job.selection_process,
        closesAt: job.closes_at,
      }}
    />
  );
}
