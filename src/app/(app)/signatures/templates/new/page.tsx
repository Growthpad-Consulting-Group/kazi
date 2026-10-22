import NewSignatureTemplatePage from "@/features/signatures/components/NewSignatureTemplatePage";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_signatures")) redirect("/signatures");
  return <NewSignatureTemplatePage />;
}
