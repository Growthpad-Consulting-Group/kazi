import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { OneOnOneDetail } from "@/features/pulse/one-on-ones/components/OneOnOneDetail";
import type { OneOnOne } from "@/types/database";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const { data } = await supabaseAdmin
    .from("one_on_ones")
    .select("*, manager:manager_id(name, avatar_url), report:report_id(name, job_title, avatar_url)")
    .eq("id", id)
    .single();

  if (!data) notFound();

  const oo = data as unknown as OneOnOne & {
    manager: { name: string; avatar_url: string | null } | null;
    report: { name: string; job_title: string | null; avatar_url: string | null } | null;
  };

  // Only manager or report can view
  const isManager = oo.manager_id === session.user.id || can(session.user.role, "manage_system");
  const isReport = oo.report_id === session.user.id;
  if (!isManager && !isReport) notFound();

  const participantIds = [oo.manager_id, oo.report_id].filter((value): value is string => Boolean(value));
  const { data: signatureProfiles } = await (supabaseAdmin as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("signature_staff_profiles")
    .select("user_id, photo_url")
    .in("user_id", participantIds);
  const signaturePhotoByUser = new Map(
    ((signatureProfiles ?? []) as { user_id: string | null; photo_url: string | null }[])
      .filter((profile) => profile.user_id && profile.photo_url)
      .map((profile) => [profile.user_id!, profile.photo_url!])
  );

  return (
    <OneOnOneDetail
      session={oo}
      managerName={oo.manager?.name ?? "Manager"}
      reportName={oo.report?.name ?? "Report"}
      managerAvatar={oo.manager?.avatar_url ?? signaturePhotoByUser.get(oo.manager_id) ?? null}
      reportAvatar={oo.report?.avatar_url ?? signaturePhotoByUser.get(oo.report_id) ?? null}
      isManager={isManager}
    />
  );
}
