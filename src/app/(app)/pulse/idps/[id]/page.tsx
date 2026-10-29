import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";
import { IdpDetail } from "@/features/pulse/idps/components/IdpDetail";
import SetPageHeader from "@/components/ui/SetPageHeader";
import type { Idp } from "@/types/database";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const { data } = await supabaseAdmin
    .from("idps")
    .select("*")
    .eq("id", id)
    .single();
  if (!data) notFound();

  const idp = data as unknown as Idp;
  const isOwner = idp.user_id === session.user.id;
  const isManager = idp.manager_id === session.user.id;
  const canManageAll = can(session.user.role, "manage_idps");
  if (!isOwner && !isManager && !canManageAll) notFound();

  const { data: owner } = await supabaseAdmin
    .from("users")
    .select("name, job_title")
    .eq("id", idp.user_id)
    .maybeSingle();

  return (
    <>
      <SetPageHeader
        title={idp.title}
        description={`Development plan${owner ? ` · ${owner.name}${owner.job_title ? ` · ${owner.job_title}` : ""}` : ""}`}
        icon="solar:book-broken"
        actions={[
          {
            label: "All plans",
            icon: "solar:alt-arrow-left-broken",
            href: "/pulse/reviews?tab=idps",
            variant: "secondary",
          },
        ]}
      />
      <IdpDetail
        idp={idp}
        canEdit={isOwner || isManager || canManageAll}
        canDelete={isManager || canManageAll}
      />
    </>
  );
}
