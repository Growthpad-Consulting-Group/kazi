import { redirect } from "next/navigation";
import { getRequestSession } from "@/lib/request-session";
import DashboardPage from "@/features/dashboard/components/DashboardPage";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; to?: string; preset?: string }>;
}) {
  const session = await getRequestSession();
  if (!session) redirect("/login");
  return <DashboardPage searchParams={searchParams} />;
}
