import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { IdpDetail } from "@/features/pulse/idps/components/IdpDetail";
import type { Idp } from "@/types/database";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const { data } = await supabaseAdmin.from("idps").select("*").eq("id", id).single();
  if (!data) notFound();

  const idp = data as unknown as Idp;
  if (idp.user_id !== session.user.id && idp.manager_id !== session.user.id) notFound();

  return <IdpDetail idp={idp} />;
}
