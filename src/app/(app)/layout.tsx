import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await cookies();
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return <AppShell>{children}</AppShell>;
}
