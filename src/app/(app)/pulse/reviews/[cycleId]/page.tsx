import ReviewCyclePage from "@/features/pulse/reviews/components/ReviewCyclePage";

export default async function Page({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  return <ReviewCyclePage cycleId={cycleId} />;
}
