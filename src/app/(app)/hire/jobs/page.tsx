import JobsPage from "@/features/hire/jobs/components/JobsPage";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  return <JobsPage initialStatus={status} />;
}
