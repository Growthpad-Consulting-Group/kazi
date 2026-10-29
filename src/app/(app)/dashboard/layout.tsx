import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DASHBOARD_ROLES, hasViewGrant } from "@/lib/rbac";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (
    !session ||
    (!DASHBOARD_ROLES.includes(session.user.role) &&
      !hasViewGrant(session.user))
  )
    redirect("/pulse");
  return children;
}
