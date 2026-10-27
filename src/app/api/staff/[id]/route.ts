import { syncSignaturePhoto } from "@/lib/signature-photo";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";
import type { UserRole } from "@/types/database";

type RouteContext = { params: Promise<{ id: string }> };

/** Admin/HR: update a staff member's profile fields. */
export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_people")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid staff ID." }, { status: 400 });
  }

  const body = await request.json() as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() || null : undefined);

  const patch: Record<string, string | null> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim().replace(/\s+/g, " ");
    if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    patch.name = name;
  }
  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const { data: clash } = await supabaseAdmin.from("users").select("id").ilike("email", email).neq("id", id).maybeSingle();
    if (clash) return NextResponse.json({ error: "That email is already in use." }, { status: 400 });
    patch.email = email;
  }
  if (body.job_title !== undefined) { const v = str(body.job_title); if (v !== undefined) patch.job_title = v; }
  if (body.location !== undefined) { const v = str(body.location); if (v !== undefined) patch.location = v; }
  if (body.department !== undefined) { const v = str(body.department); if (v !== undefined) patch.department = v; }
  if (body.manager_id !== undefined) {
    const v = str(body.manager_id);
    if (v !== undefined) {
      if (v === id) return NextResponse.json({ error: "A staff member cannot be their own manager." }, { status: 400 });
      patch.manager_id = v;
    }
  }
  if (body.start_date !== undefined) { const v = str(body.start_date); if (v !== undefined) patch.start_date = v; }
  if (body.date_of_birth !== undefined) { const v = str(body.date_of_birth); if (v !== undefined) patch.date_of_birth = v; }
  if (body.avatar_url !== undefined) { const v = str(body.avatar_url); if (v !== undefined) patch.avatar_url = v; }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No fields to update." }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabaseAdmin.from("users").update(patch as any).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (patch.avatar_url !== undefined) await syncSignaturePhoto(id, patch.avatar_url);

  await invalidateTables("users");
  return NextResponse.json({ ok: true });
}

/** Removes access without destroying the staff member's historical HR record. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "view_people")) {
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
