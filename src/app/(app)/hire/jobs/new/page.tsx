import { JobForm } from "@/features/hire/jobs/components/JobForm";
import { getDepartments } from "@/features/departments/actions";
import SetPageHeader from "@/components/ui/SetPageHeader";

export default async function NewJobPage() {
  const departments = await getDepartments().catch(() => []);
  return (
    <>
      <SetPageHeader
        title="New Job"
        description="Create a role and set up AI screening"
        icon="solar:case-minimalistic-broken"
        actions={[{ label: "Back to Jobs", icon: "solar:arrow-left-broken", href: "/hire/jobs" }]}
      />
      <JobForm departments={departments} />
    </>
  );
}
