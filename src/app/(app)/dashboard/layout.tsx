import { redirect } from "next/navigation";
import { getRequestSession } from "@/lib/request-session";
import { DASHBOARD_ROLES, hasViewGrant } from "@/lib/rbac";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getRequestSession();
  if (
    !session ||
    (!DASHBOARD_ROLES.includes(session.user.role) &&
      !hasViewGrant(session.user))
  )
    redirect("/pulse");
  return children;
}
