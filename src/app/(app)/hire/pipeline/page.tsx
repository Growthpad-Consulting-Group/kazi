import PipelinePage from "@/features/hire/pipeline/components/PipelinePage";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const { job } = await searchParams;
  return <PipelinePage jobId={job} />;
}
