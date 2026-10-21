import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";
import type { UserRole } from "@/types/database";

type RouteContext = { params: Promise<{ id: string }> };

/** Removes access without destroying the staff member's historical HR record. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "hr")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid staff member." }, { status: 400 });
  }
  if (id === session.user.id) {
    return NextResponse.json({ error: "You cannot remove your own account." }, { status: 400 });
  }

  const { data: staffMember, error: lookupError } = await supabaseAdmin
    .from("users")
    .select("id, role, is_active")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (!staffMember) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
  if (!staffMember.is_active) return NextResponse.json({ error: "This staff member has already been removed." }, { status: 400 });
  if (staffMember.role === "admin" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Only an administrator can remove another administrator." }, { status: 403 });
  }

  if (staffMember.role === "admin") {
    const { count, error } = await supabaseAdmin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin" as UserRole)
      .eq("is_active", true);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "Kazi must retain at least one active administrator." }, { status: 400 });
    }
  }

  const { error: reportsError } = await supabaseAdmin
    .from("users")
    .update({ manager_id: null })
    .eq("manager_id", id);
  if (reportsError) return NextResponse.json({ error: reportsError.message }, { status: 500 });

  const { error } = await supabaseAdmin
    .from("users")
    .update({ is_active: false })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await invalidateTables("users");
  return NextResponse.json({ ok: true });
}
