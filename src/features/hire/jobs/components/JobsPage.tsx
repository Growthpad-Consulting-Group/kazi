import { getJobs } from "../actions";
import JobsClientView from "./JobsClientView";
import PageHeader from "@/components/ui/PageHeader";

export default async function JobsPage() {
  const jobs = await getJobs();
  const departments = Array.from(
    new Set(jobs.map((j) => j.department).filter(Boolean) as string[])
  ).sort();

  return (
    <div className="space-y-0">
      <PageHeader
        title="Jobs"
        description={`${jobs.length} role${jobs.length !== 1 ? "s" : ""} across your organisation`}
        icon="solar:case-broken"
        actions={[
          {
            label: "New Job",
            icon: "solar:add-circle-broken",
            href: "/hire/jobs/new",
            variant: "primary",
          },
        ]}
      />

      <JobsClientView jobs={jobs} departments={departments} />
    </div>
  );
}
