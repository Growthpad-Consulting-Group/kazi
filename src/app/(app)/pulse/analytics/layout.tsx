import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

const ANALYTICS_ROLES = ["admin", "hr", "hiring_manager", "manager"] as const;

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || !ANALYTICS_ROLES.includes(session.user.role as typeof ANALYTICS_ROLES[number])) redirect("/pulse");
  return children;
}
