import CandidatesPage from "@/features/hire/candidates/components/CandidatesPage";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const { job } = await searchParams;
  return <CandidatesPage jobId={job} />;
}
