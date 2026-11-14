import { getJobApplicantCounts, getJobs } from "../actions";
import { getDepartments } from "@/features/departments/actions";
import JobsClientView from "./JobsClientView";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { careersPageUrl } from "@/lib/careers-url";
import { getActiveHireWorkspace } from "@/lib/hire-workspace";
import HireWorkspaceSwitcher from "@/features/hire/components/HireWorkspaceSwitcher";
import { canManageHireCompany } from "@/lib/hire-company-access";
import NewJobWorkspacePicker from "./NewJobWorkspacePicker";

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
  const writableCompanies = workspace.access
    .filter((company) => canManageHireCompany(company.role))
    .map(({ slug, displayName }) => ({ slug, displayName }));

  return (
    <>
      <SetPageHeader
        title="Jobs"
        description={`${jobs.length} role${jobs.length !== 1 ? "s" : ""} in ${workspace.company.displayName}`}
        icon="solar:case-minimalistic-broken"
        actions={
          workspace.isAggregate
            ? []
            : [
                {
                  label: "Careers page",
                  icon: "solar:global-broken",
                  href: careersPageUrl(workspace.company.slug),
                  variant: "secondary",
                },
              ]
        }
        trailing={
          <div className="flex items-center gap-2">
            <HireWorkspaceSwitcher
              companies={workspace.access}
              activeSlug={workspace.company.slug}
            />
            <NewJobWorkspacePicker
              companies={writableCompanies}
              activeCompanySlug={
                workspace.isAggregate ? undefined : workspace.company.slug
              }
            />
          </div>
        }
        trailingIsFilter
      />
      <JobsClientView
        jobs={jobs}
        departments={departments}
        companySlug={workspace.company.slug}
        initialStatus={initialStatus}
        readOnly={workspace.isAggregate}
      />
    </>
  );
}
