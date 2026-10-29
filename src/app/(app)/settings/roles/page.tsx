import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isPathAllowed } from "@/lib/page-access";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { can } from "@/lib/rbac";
import RolesClient from "@/features/settings/components/RolesClient";
import { listPageGrants } from "@/lib/page-access-server";

export default async function RolesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!isPathAllowed(session.user.allowedPaths, "/settings/roles"))
    redirect("/settings/profile");

  const grants = await listPageGrants();

  return (
    <div className="space-y-6">
      <SetPageHeader
        title="Roles & Permissions"
        description="Choose what each role can open in Kazi."
        icon="solar:shield-check-broken"
      />
      <RolesClient
        grants={grants}
        canEdit={can(session.user.role, "manage_roles")}
      />
    </div>
  );
}
