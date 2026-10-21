import StaffProfilePage from "@/features/signatures/components/StaffProfilePage";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <StaffProfilePage id={id} />; }
