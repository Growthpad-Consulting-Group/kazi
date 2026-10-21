import NewSignatureTemplatePage from "@/features/signatures/components/NewSignatureTemplatePage";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "hr")) redirect("/signatures");
  return <NewSignatureTemplatePage />;
}
