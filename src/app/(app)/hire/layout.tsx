import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { RECRUITMENT_ROLES } from "@/lib/rbac";

export default async function HireLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  // People with the read-only admin grant can review hiring screens too.
  const canView =
    session?.user.extraPermissions?.includes("view_admin_screens") ?? false;
  if (!session || (!RECRUITMENT_ROLES.includes(session.user.role) && !canView))
    redirect("/pulse");
  return children;
}
