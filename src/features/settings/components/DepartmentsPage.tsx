import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getDepartmentsWithUsage } from "@/features/departments/actions";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { DepartmentsClient } from "./DepartmentsClient";

export default async function DepartmentsPage() {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_departments")) redirect("/dashboard");

  const departments = await getDepartmentsWithUsage().catch(() => []);

  return (
    <div className="space-y-6">
      <SetPageHeader
        title="Departments"
        description="Manage the list used by job and people forms"
        icon="solar:users-group-two-rounded-broken"
      />
      <DepartmentsClient initial={departments} />
    </div>
  );
}
