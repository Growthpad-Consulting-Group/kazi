import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/rbac";

export default async function PeopleLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || !STAFF_ROLES.includes(session.user.role)) redirect("/pulse");
  return children;
}
