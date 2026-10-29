import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import type { UserRole } from "@/types/database";

const ROLES: UserRole[] = [
  "admin",
  "hr",
  "hiring_manager",
  "manager",
  "interviewer",
  "employee",
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("users")
    .select(
      "id, name, email, role, department, job_title, is_active, created_at",
    )
    .order("name");

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as { id?: string; role?: string };
  const { id, role } = body;

  if (!id || typeof id !== "string")
    return NextResponse.json(
      { error: "User ID is required." },
      { status: 400 },
    );
  if (!role || !ROLES.includes(role as UserRole))
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });

  // Prevent demoting yourself
  if (id === session.user.id && role !== "admin")
    return NextResponse.json(
      { error: "You cannot change your own role." },
      { status: 400 },
    );

  const { error } = await supabaseAdmin
    .from("users")
    .update({ role: role as UserRole })
    .eq("id", id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
