import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";
import type { UserRole } from "@/types/database";

const ROLES: UserRole[] = ["admin", "hr", "hiring_manager", "manager", "interviewer", "employee"];

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "hr")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json() as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = typeof body.role === "string" && ROLES.includes(body.role as UserRole) ? body.role as UserRole : "employee";

  if (!name || !email || !password) return NextResponse.json({ error: "Name, email, and temporary password are required." }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Temporary password must be at least 8 characters." }, { status: 400 });
  if (role === "admin" && session.user.role !== "admin") return NextResponse.json({ error: "Only an administrator can create an admin account." }, { status: 403 });

  const { data: existing } = await supabaseAdmin.from("users").select("id").eq("email", email).maybeSingle();
  if (existing) return NextResponse.json({ error: "A staff member with this email already exists." }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  const { data, error } = await supabaseAdmin.from("users").insert({
    name,
    email,
    password_hash: passwordHash,
    role,
    department: typeof body.department === "string" && body.department ? body.department : null,
    job_title: typeof body.jobTitle === "string" && body.jobTitle ? body.jobTitle.trim() : null,
    location: typeof body.location === "string" && body.location ? body.location.trim() : null,
    manager_id: typeof body.managerId === "string" && body.managerId ? body.managerId : null,
    start_date: typeof body.startDate === "string" && body.startDate ? body.startDate : null,
    is_active: true,
  }).select("id, name").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateTables("users");
  return NextResponse.json({ person: data });
}
