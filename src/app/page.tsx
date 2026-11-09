import { redirect } from "next/navigation";
import { getRequestSession } from "@/lib/request-session";
import { DASHBOARD_ROLES } from "@/lib/rbac";

export default async function RootPage() {
  const session = await getRequestSession();
  if (session && !DASHBOARD_ROLES.includes(session.user.role))
    redirect("/pulse");
  redirect("/dashboard");
}
