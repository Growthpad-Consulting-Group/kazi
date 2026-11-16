import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { RECRUITMENT_ROLES } from "@/lib/rbac";
import { hasHireCompanyAccess } from "@/lib/hire-company-access";

export default async function HireLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  // People with the read-only admin grant can review hiring screens too.
  const canView =
    session?.user.extraPermissions?.includes("view_admin_screens") ?? false;
  const hasCompanyHireAccess = session
    ? await hasHireCompanyAccess(session.user.id, session.user.role)
    : false;
  if (
    !session ||
    (!RECRUITMENT_ROLES.includes(session.user.role) &&
      !canView &&
      !hasCompanyHireAccess)
  )
    redirect("/pulse");
  return children;
}
