import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import SetPageHeader from "@/components/ui/SetPageHeader";
import SecurityClient from "./SecurityClient";

export default async function SecurityPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <SetPageHeader title="Security" description="Password and session management" icon="solar:shield-keyhole-broken" />
      <SecurityClient />
    </div>
  );
}
