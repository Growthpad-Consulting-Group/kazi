import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { can, canView } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import DomainsClient from "./DomainsClient";

type Result = { data: unknown; error: { message: string } | null };
type Database = {
  from: (table: string) => { select: (columns: string) => PromiseLike<Result> };
};
export default async function DomainsPage() {
  const session = await getServerSession(authOptions);
  if (!session || !canView(session.user, "manage_signatures"))
    redirect("/signatures");
  const db = supabaseAdmin as unknown as Database;
  const { data, error } = await db
    .from("signature_domains")
    .select("id,name,platform,gateway_status,spf_verified,dkim_verified,notes");
  if (error) throw new Error(error.message);
  return <DomainsClient domains={data as never[]} />;
}
