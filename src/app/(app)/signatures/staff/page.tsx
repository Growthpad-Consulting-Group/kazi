import StaffAssignmentsPage from "@/features/signatures/components/StaffAssignmentsPage";

export default async function Page({ searchParams }: { searchParams: Promise<{ delivery?: string }> }) {
  const { delivery } = await searchParams;
  return <StaffAssignmentsPage initialDelivery={delivery} />;
}
