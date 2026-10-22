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
    .select("*, manager:manager_id(name), report:report_id(name, job_title)")
    .eq("id", id)
    .single();

  if (!data) notFound();

  const oo = data as unknown as OneOnOne & {
    manager: { name: string } | null;
    report: { name: string; job_title: string | null } | null;
  };

  // Only manager or report can view
  const isManager = oo.manager_id === session.user.id || can(session.user.role, "manage_system");
  const isReport = oo.report_id === session.user.id;
  if (!isManager && !isReport) notFound();

  return (
    <OneOnOneDetail
      session={oo}
      managerName={oo.manager?.name ?? "Manager"}
      reportName={oo.report?.name ?? "Report"}
      isManager={isManager}
    />
  );
}
