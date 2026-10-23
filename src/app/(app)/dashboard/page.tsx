import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import DashboardPage from "@/features/dashboard/components/DashboardPage";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; to?: string; preset?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <DashboardPage searchParams={searchParams} />;
}
