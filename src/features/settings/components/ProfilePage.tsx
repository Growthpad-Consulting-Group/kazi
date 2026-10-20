import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import SetPageHeader from "@/components/ui/SetPageHeader";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <SetPageHeader title="Profile" description="Your personal details and access" icon="solar:user-broken" />
      <ProfileClient
        initial={{
          name: session.user.name ?? "",
          email: session.user.email ?? "",
          role: session.user.role,
          department: session.user.department,
        }}
      />
    </div>
  );
}
