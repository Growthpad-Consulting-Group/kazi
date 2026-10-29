import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { clearMustChangePassword } from "@/lib/must-change-password";

type RouteContext = { params: Promise<{ id: string }> };

/** Gives someone a temporary password. They must choose their own at their next sign-in. */
export async function POST(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_people"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json(
      { error: "Invalid staff member." },
      { status: 400 },
    );
  if (id === session.user.id)
    return NextResponse.json(
      { error: "Use Profile → Security to change your own password." },
      { status: 400 },
    );

  const body = (await request.json().catch(() => null)) as {
    password?: unknown;
  } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 8)
    return NextResponse.json(
      { error: "Temporary password must be at least 8 characters." },
      { status: 400 },
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- must_change_password is newer than the generated types
  const db = supabaseAdmin as any;
  const { data: target, error: findError } = await db
    .from("users")
    .select("id, role, is_active")
    .eq("id", id)
    .maybeSingle();
  if (findError)
    return NextResponse.json({ error: findError.message }, { status: 500 });
  if (!target)
    return NextResponse.json(
      { error: "Staff member not found." },
      { status: 404 },
    );
  // Only an admin can reset an admin's password.
  if (
    (target as { role: string }).role === "admin" &&
    session.user.role !== "admin"
  ) {
    return NextResponse.json(
      { error: "Only an admin can reset an admin's password." },
      { status: 403 },
    );
  }

  const hash = await bcrypt.hash(password, 10);
  const { error } = await db
    .from("users")
    .update({ password_hash: hash, must_change_password: true })
    .eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  clearMustChangePassword(id);
  return NextResponse.json({ ok: true });
}
