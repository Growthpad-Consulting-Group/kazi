import { getJobs } from "../actions";
import { getDepartments } from "@/features/departments/actions";
import JobsClientView from "./JobsClientView";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { careersPageUrl } from "@/lib/careers-url";

export default async function JobsPage({ initialStatus }: { initialStatus?: string }) {
  const jobs = await getJobs();
  const listed = await getDepartments().catch(() => [] as string[]);
  const departments = Array.from(
    new Set([...listed, ...(jobs.map((j) => j.department).filter(Boolean) as string[])])
  ).sort((a, b) => a.localeCompare(b));

  return (
    <>
      <SetPageHeader
        title="Jobs"
        description={`${jobs.length} role${jobs.length !== 1 ? "s" : ""} across your organisation`}
        icon="solar:case-minimalistic-broken"
        actions={[
          { label: "Careers page", icon: "solar:global-broken", href: careersPageUrl(), variant: "secondary" },
          { label: "New Job", icon: "solar:add-circle-broken", href: "/hire/jobs/new", variant: "primary" },
        ]}
      />
      <JobsClientView jobs={jobs} departments={departments} initialStatus={initialStatus} />
    </>
  );
}
