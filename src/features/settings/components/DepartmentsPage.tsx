import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isPathAllowed } from "@/lib/page-access";
import { can } from "@/lib/rbac";
import { getDepartmentsWithUsage } from "@/features/departments/actions";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { DepartmentsClient } from "./DepartmentsClient";
import { EditableArea, ViewOnlyNotice } from "./EditableArea";

export default async function DepartmentsPage() {
  const session = await getServerSession(authOptions);
  if (!session || !isPathAllowed(session.user.allowedPaths, "/settings/departments")) redirect("/settings/profile");
  const canEdit = can(session.user.role, "manage_departments");

  const departments = await getDepartmentsWithUsage().catch(() => []);

  return (
    <div className="space-y-6">
      <SetPageHeader
        title="Departments"
        description="Manage the list used by job and staff forms"
        icon="solar:users-group-two-rounded-broken"
      />
      {!canEdit && <ViewOnlyNotice permissionLabel="department management" />}
      <EditableArea canEdit={canEdit}>
        <DepartmentsClient initial={departments} />
      </EditableArea>
    </div>
  );
}
