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
    .select("id, title, department, status")
    .eq("id", jobId)
    .single();

  if (!job || job.status !== "open") notFound();

  return <ApplyPage jobId={job.id} jobTitle={job.title} />;
}
