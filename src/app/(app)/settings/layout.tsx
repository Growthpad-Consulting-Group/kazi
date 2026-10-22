import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SETTINGS_ROLES } from "@/lib/rbac";
import SettingsShell from "@/features/settings/components/SettingsShell";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || !SETTINGS_ROLES.includes(session.user.role)) redirect("/pulse");
  return <SettingsShell>{children}</SettingsShell>;
}
