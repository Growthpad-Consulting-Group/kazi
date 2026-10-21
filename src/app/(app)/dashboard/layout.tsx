import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

const DASHBOARD_ROLES = ["admin", "hr", "hiring_manager", "manager"] as const;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || !DASHBOARD_ROLES.includes(session.user.role as typeof DASHBOARD_ROLES[number])) redirect("/pulse");
  return children;
}
