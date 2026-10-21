import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

const RECRUITMENT_ROLES = ["admin", "hr", "hiring_manager", "interviewer"] as const;

export default async function HireLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || !RECRUITMENT_ROLES.includes(session.user.role as typeof RECRUITMENT_ROLES[number])) redirect("/pulse");
  return children;
}
