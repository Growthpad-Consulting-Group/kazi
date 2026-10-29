import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";
import { PipDetail } from "@/features/pulse/pips/components/PipDetail";
import type { Pip } from "@/types/database";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const { id: userId, role } = session.user;

  const { data } = await supabaseAdmin
    .from("pips")
    .select("*")
    .eq("id", id)
    .single();
  if (!data) notFound();

  const pip = data as unknown as Pip;
  const isEditor =
    pip.manager_id === userId ||
    pip.hr_id === userId ||
    can(role, "manage_pips");
  if (pip.user_id !== userId && !isEditor) notFound();

  const { data: employee } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", pip.user_id)
    .single();

  return (
    <div className="p-8">
      <PipDetail
        pip={pip}
        employeeName={employee?.name ?? "Employee"}
        canEdit={isEditor}
        isEmployee={pip.user_id === userId}
      />
    </div>
  );
}
