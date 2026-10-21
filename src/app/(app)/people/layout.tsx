import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

const PEOPLE_ROLES = ["admin", "hr", "hiring_manager", "manager"] as const;

export default async function PeopleLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || !PEOPLE_ROLES.includes(session.user.role as typeof PEOPLE_ROLES[number])) redirect("/pulse");
  return children;
}
