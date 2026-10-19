import InterviewPage from "@/features/hire/interview/components/InterviewPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InterviewPage candidateId={id} />;
}
