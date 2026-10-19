import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { managerId, reportId, scheduledAt } = await req.json();
  if (!managerId || !reportId) {
    return NextResponse.json({ error: "managerId and reportId required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("one_on_ones")
    .insert({ manager_id: managerId, report_id: reportId, scheduled_at: scheduledAt ?? null })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: (data as unknown as { id: string }).id });
}
