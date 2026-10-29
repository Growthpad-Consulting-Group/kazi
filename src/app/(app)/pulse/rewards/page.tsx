import RewardsPage from "@/features/pulse/rewards/components/RewardsPage";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return <RewardsPage tab={tab} />;
}
