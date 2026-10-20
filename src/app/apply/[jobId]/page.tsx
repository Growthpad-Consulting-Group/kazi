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
    .select("id, title, department, status, published_at, closes_at")
    .eq("id", jobId)
    .single();

  const now = new Date();
  if (
    !job ||
    job.status !== "open" ||
    (job.published_at && new Date(job.published_at) > now) ||
    (job.closes_at && new Date(job.closes_at) <= now)
  ) notFound();

  return <ApplyPage jobId={job.id} jobTitle={job.title} />;
}
