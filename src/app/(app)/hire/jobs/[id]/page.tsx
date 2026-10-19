import JobDetailPage from "@/features/hire/jobs/components/JobDetailPage";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobDetailPage id={id} />;
}
