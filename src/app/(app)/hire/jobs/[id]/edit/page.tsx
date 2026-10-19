import { JobForm } from "@/features/hire/jobs/components/JobForm";
import { getJob } from "@/features/hire/jobs/actions";
import { notFound } from "next/navigation";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id).catch(() => null);
  if (!job) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Edit Job</h1>
      <JobForm job={job} />
    </div>
  );
}
