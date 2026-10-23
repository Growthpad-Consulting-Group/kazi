import LeadershipDashboard from "@/features/pulse/analytics/components/LeadershipDashboard";
import RecognitionAnalyticsPage from "@/features/pulse/analytics/components/RecognitionAnalyticsPage";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; dept?: string; campaign?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="space-y-10">
      <LeadershipDashboard />
      <hr className="border-[var(--border)]" />
      <RecognitionAnalyticsPage searchParams={params} />
    </div>
  );
}
