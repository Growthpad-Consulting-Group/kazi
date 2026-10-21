import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import SettingsShell from "@/features/settings/components/SettingsShell";

const SETTINGS_ROLES = ["admin", "hr"] as const;

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || !SETTINGS_ROLES.includes(session.user.role as typeof SETTINGS_ROLES[number])) redirect("/pulse");
  return <SettingsShell>{children}</SettingsShell>;
}
