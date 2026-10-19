import { JobForm } from "@/features/hire/jobs/components/JobForm";

export default function NewJobPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">New Job</h1>
      <JobForm />
    </div>
  );
}
