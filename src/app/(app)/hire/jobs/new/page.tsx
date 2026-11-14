import { JobForm } from "@/features/hire/jobs/components/JobForm";
import { getDepartments } from "@/features/departments/actions";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { getActiveHireWorkspace } from "@/lib/hire-workspace";
import { redirect } from "next/navigation";

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const { company } = await searchParams;
  const workspace = await getActiveHireWorkspace(company);
  if (workspace.isAggregate) redirect("/hire/jobs");
  const departments = await getDepartments().catch(() => []);
  return (
    <>
      <SetPageHeader
        title="New Job"
        description={`Create a role for ${workspace.company.displayName} and set up AI screening`}
        icon="solar:case-minimalistic-broken"
        actions={[
          {
            label: "Back to Jobs",
            icon: "solar:arrow-left-broken",
            href: `/hire/jobs?company=${workspace.company.slug}`,
          },
        ]}
      />
      <JobForm departments={departments} companySlug={workspace.company.slug} />
    </>
  );
}
