import type { JobStatus } from "@/types/database";

const styles: Record<JobStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  open: "bg-green-100 text-green-700",
  closed: "bg-red-100 text-red-600",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}
