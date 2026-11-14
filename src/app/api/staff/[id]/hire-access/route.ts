import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { recordHireAuditEvent } from "@/lib/hire-audit";
import type { HireCompanyRole } from "@/lib/hire-company-access";

type RouteContext = { params: Promise<{ id: string }> };

const HIRE_ROLES: HireCompanyRole[] = [
  "viewer",
  "hiring_manager",
  "recruiter",
  "company_admin",
];

/** Admin-only Hire company membership changes for an existing staff account. */
export async function POST(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_roles"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: userId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(userId))
    return NextResponse.json(
      { error: "Invalid staff member." },
      { status: 400 },
    );
  if (userId === session.user.id)
    return NextResponse.json(
      { error: "You can't change your own Hire access." },
      { status: 400 },
    );

  const body = (await request.json().catch(() => null)) as {
    companyId?: unknown;
    role?: unknown;
  } | null;
  const companyId = typeof body?.companyId === "string" ? body.companyId : "";
  const role = body?.role;
  if (!/^[0-9a-f-]{36}$/i.test(companyId))
    return NextResponse.json({ error: "Choose a company." }, { status: 400 });
  if (role !== null && !HIRE_ROLES.includes(role as HireCompanyRole))
    return NextResponse.json(
      { error: "Choose a valid Hire role." },
      { status: 400 },
    );

  const [{ data: staff }, { data: company }] = await Promise.all([
    supabaseAdmin.from("users").select("id").eq("id", userId).maybeSingle(),
    supabaseAdmin
      .from("companies")
      .select("id, display_name")
      .eq("id", companyId)
      .eq("is_active", true)
      .maybeSingle(),
  ]);
  if (!staff || !company)
    return NextResponse.json(
      { error: "The staff member or company is unavailable." },
      { status: 404 },
    );

  if (role === null) {
    const { error } = await supabaseAdmin
      .from("company_memberships")
      .delete()
      .eq("company_id", companyId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    await recordHireAuditEvent({
      companyId,
      actorUserId: session.user.id,
      action: "membership.revoked",
      entityType: "company_membership",
      entityId: userId,
      metadata: { company: company.display_name },
    });
    return NextResponse.json({ role: null });
  }

  const { data: membership, error } = await supabaseAdmin
    .from("company_memberships")
    .upsert(
      {
        company_id: companyId,
        user_id: userId,
        hire_role: role as HireCompanyRole,
        is_active: true,
        created_by: session.user.id,
      },
      { onConflict: "company_id,user_id" },
    )
    .select("hire_role")
    .single();
  if (error) throw new Error(error.message);

  await recordHireAuditEvent({
    companyId,
    actorUserId: session.user.id,
    action: "membership.updated",
    entityType: "company_membership",
    entityId: userId,
    metadata: { company: company.display_name, role: membership.hire_role },
  });
  return NextResponse.json({ role: membership.hire_role });
}
