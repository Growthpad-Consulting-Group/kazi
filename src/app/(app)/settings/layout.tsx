import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import SettingsShell from "@/features/settings/components/SettingsShell";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  // All authenticated users may access Personal settings (profile, security).
  // Org/data sections guard themselves individually.
  if (!session) redirect("/login");
  return <SettingsShell>{children}</SettingsShell>;
}
