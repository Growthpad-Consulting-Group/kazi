import EmployeeProfilePage from "@/features/staff/components/EmployeeProfilePage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmployeeProfilePage id={id} />;
}
