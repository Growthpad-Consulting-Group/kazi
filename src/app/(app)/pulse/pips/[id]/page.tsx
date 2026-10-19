import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { hasRole } from "@/lib/rbac";
import { PipDetail } from "@/features/pulse/pips/components/PipDetail";
import type { Pip } from "@/types/database";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const { id: userId, role } = session.user;
  const isManager = hasRole(role, "manager");

  const { data } = await supabaseAdmin.from("pips").select("*").eq("id", id).single();
  if (!data) notFound();

  const pip = data as unknown as Pip;
  if (pip.user_id !== userId && pip.manager_id !== userId) notFound();

  const { data: employee } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", pip.user_id)
    .single();

  return (
    <div className="p-8">
      <PipDetail pip={pip} isManager={isManager} employeeName={employee?.name ?? "Employee"} />
    </div>
  );
}
