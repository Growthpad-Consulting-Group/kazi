import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import SetPageHeader from "@/components/ui/SetPageHeader";
import RolesClient from "@/features/settings/components/RolesClient";

export default async function RolesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!can(session.user.role, "manage_roles")) redirect("/settings/profile");

  return (
    <div className="space-y-6">
      <SetPageHeader
        title="Roles & Permissions"
        description="Reference for what each role can do in Kazi."
        icon="solar:shield-check-broken"
      />
      <RolesClient />
    </div>
  );
}
