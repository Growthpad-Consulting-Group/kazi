/* eslint-disable @typescript-eslint/no-explicit-any -- must_change_password is newer than the generated types */
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";
import { canonicalDepartment } from "@/lib/departments";
import type { UserRole } from "@/types/database";

const ROLES: UserRole[] = ["admin", "hr", "hiring_manager", "manager", "interviewer", "employee"];
type SignatureResult = { data: unknown; error: { message: string } | null };
type SignatureDatabase = { from: (table: string) => { select: (columns: string) => PromiseLike<SignatureResult>; insert: (values: Record<string, unknown>) => PromiseLike<SignatureResult> } };

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_people")) {
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
  let department: string | null;
  try {
    department = await canonicalDepartment(typeof body.department === "string" ? body.department : null);
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Invalid department." }, { status: 400 });
  }

  // Staff with a company email automatically become available in Kazi Signatures.
  // A signature profile must point at a configured sending domain, so non-company
  // addresses remain normal Kazi staff without an unusable signature deployment.
  const signatureDatabase = supabaseAdmin as unknown as SignatureDatabase;
  const { data: domainData, error: domainError } = await signatureDatabase.from("signature_domains").select("id, name");
  if (domainError) return NextResponse.json({ error: domainError.message }, { status: 500 });
  const emailDomain = email.split("@")[1];
  const signatureDomain = ((domainData ?? []) as { id: string; name: string }[]).find((domain) => domain.name.toLowerCase() === emailDomain);

  const { data: existing } = await supabaseAdmin.from("users").select("id").eq("email", email).maybeSingle();
  if (existing) return NextResponse.json({ error: "A staff member with this email already exists." }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  const { data, error } = await (supabaseAdmin as any).from("users").insert({
    name,
    email,
    password_hash: passwordHash, must_change_password: true,
    role,
    department,
    job_title: typeof body.jobTitle === "string" && body.jobTitle ? body.jobTitle.trim() : null,
    location: typeof body.location === "string" && body.location ? body.location.trim() : null,
    manager_id: typeof body.managerId === "string" && body.managerId ? body.managerId : null,
    start_date: typeof body.startDate === "string" && body.startDate ? body.startDate : null,
    is_active: true,
  }).select("id, name").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (signatureDomain) {
    const { error: profileError } = await signatureDatabase.from("signature_staff_profiles").insert({
      user_id: data.id,
      domain_id: signatureDomain.id,
      email,
      full_name: name,
      role_title: typeof body.jobTitle === "string" && body.jobTitle ? body.jobTitle.trim() : null,
      department,
      status: "active",
    });
    if (profileError) return NextResponse.json({ error: `Staff account was created, but its signature profile could not be linked: ${profileError.message}` }, { status: 500 });
  }

  await invalidateTables("users");
  return NextResponse.json({ person: data, signatureProfileCreated: Boolean(signatureDomain) });
}
