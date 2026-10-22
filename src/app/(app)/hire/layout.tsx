import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { RECRUITMENT_ROLES } from "@/lib/rbac";

export default async function HireLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || !RECRUITMENT_ROLES.includes(session.user.role)) redirect("/pulse");
  return children;
}
