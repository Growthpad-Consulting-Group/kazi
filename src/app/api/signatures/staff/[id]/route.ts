import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { canonicalDepartment } from "@/lib/departments";

type RouteContext = { params: Promise<{ id: string }> };
type UpdateResult = { error: { message: string } | null };
type Database = { from: (table: string) => { update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => PromiseLike<UpdateResult> } } };

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "hr")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid staff profile." }, { status: 400 });

  const body = await request.json() as Record<string, unknown>;
  const values: Record<string, unknown> = {};
  for (const field of ["full_name", "role_title", "department", "phone", "mobile", "photo_url", "status"] as const) {
    if (field in body) values[field] = typeof body[field] === "string" ? body[field].trim() || null : body[field];
  }
  if (!Object.keys(values).length) return NextResponse.json({ error: "No editable fields supplied." }, { status: 400 });
  if (values.status && !["active", "suspended"].includes(String(values.status))) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  if ("department" in values) {
    try {
      values.department = await canonicalDepartment(typeof values.department === "string" ? values.department : null);
    } catch (cause) {
      return NextResponse.json({ error: cause instanceof Error ? cause.message : "Invalid department." }, { status: 400 });
    }
  }

  const database = supabaseAdmin as unknown as Database;
  const { error } = await database.from("signature_staff_profiles").update(values).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
