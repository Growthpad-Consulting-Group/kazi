import { getJobApplicantCounts, getJobs } from "../actions";
import { getDepartments } from "@/features/departments/actions";
import JobsClientView from "./JobsClientView";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { careersPageUrl } from "@/lib/careers-url";
import { getActiveHireWorkspace } from "@/lib/hire-workspace";
import HireWorkspaceSwitcher from "@/features/hire/components/HireWorkspaceSwitcher";

export default async function JobsPage({
  initialStatus,
  companySlug,
}: {
  initialStatus?: string;
  companySlug?: string;
}) {
  const workspace = await getActiveHireWorkspace(companySlug);
  const [jobRows, applicantCounts] = await Promise.all([
    getJobs(workspace.company.slug),
    getJobApplicantCounts(workspace.company.slug),
  ]);
  const jobs = jobRows.map((job) => ({
    ...job,
    applicants: applicantCounts[job.id]?.applicants ?? 0,
    shortlisted: applicantCounts[job.id]?.shortlisted ?? 0,
  }));
  const listed = await getDepartments().catch(() => [] as string[]);
  const departments = Array.from(
    new Set([
      ...listed,
      ...(jobs.map((j) => j.department).filter(Boolean) as string[]),
    ]),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <>
      <SetPageHeader
        title="Jobs"
        description={`${jobs.length} role${jobs.length !== 1 ? "s" : ""} in ${workspace.company.displayName}`}
        icon="solar:case-minimalistic-broken"
        actions={[
          {
            label: "Careers page",
            icon: "solar:global-broken",
            href: careersPageUrl(),
            variant: "secondary",
          },
          ...(workspace.isAggregate
            ? []
            : [
                {
                  label: "New Job",
                  icon: "solar:add-circle-broken",
                  href: `/hire/jobs/new?company=${workspace.company.slug}`,
                  variant: "primary" as const,
                  write: true,
                },
              ]),
        ]}
        trailing={
          <HireWorkspaceSwitcher
            companies={workspace.access}
            activeSlug={workspace.company.slug}
          />
        }
        trailingIsFilter
      />
      <JobsClientView
        jobs={jobs}
        departments={departments}
        initialStatus={initialStatus}
        readOnly={workspace.isAggregate}
      />
    </>
  );
}
