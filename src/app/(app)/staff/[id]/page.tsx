import EmployeeProfilePage from "@/features/staff/components/EmployeeProfilePage";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string | string[] }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  return <EmployeeProfilePage id={id} tab={typeof tab === "string" ? tab : undefined} />;
}
