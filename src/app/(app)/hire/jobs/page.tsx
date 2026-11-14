import JobsPage from "@/features/hire/jobs/components/JobsPage";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; company?: string }>;
}) {
  const { status, company } = await searchParams;
  return <JobsPage initialStatus={status} companySlug={company} />;
}
