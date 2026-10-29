import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ANALYTICS_ROLES, hasViewGrant } from "@/lib/rbac";

export default async function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (
    !session ||
    (!ANALYTICS_ROLES.includes(session.user.role) &&
      !hasViewGrant(session.user))
  )
    redirect("/pulse");
  return children;
}
