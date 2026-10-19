import CandidateDetailPage from "@/features/hire/candidates/components/CandidateDetailPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CandidateDetailPage id={id} />;
}
