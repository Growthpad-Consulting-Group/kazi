import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

type Criterion = { name: string; weight: number; guidance: string };

function validCriteria(value: unknown): value is Criterion[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 12 &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Criterion).name === "string" &&
        (item as Criterion).name.trim().length > 0 &&
        (item as Criterion).name.length <= 100 &&
        Number.isInteger((item as Criterion).weight) &&
        (item as Criterion).weight > 0 &&
        (item as Criterion).weight <= 100 &&
        typeof (item as Criterion).guidance === "string" &&
        (item as Criterion).guidance.length <= 500,
    ) &&
    value.reduce((sum, item) => sum + item.weight, 0) === 100
  );
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table
  const { data, error } = await (supabaseAdmin as any)
    .from("review_competency_templates")
    .select("id, name, scope, scope_value, criteria")
    .eq("is_active", true)
    .order("name");
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_reviews"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const scope = body?.scope;
  const scopeValue =
    typeof body?.scopeValue === "string" ? body.scopeValue.trim() : "";
  if (
    !name ||
    name.length > 120 ||
    !["company", "department", "role"].includes(String(scope)) ||
    (scope !== "company" && !scopeValue) ||
    !validCriteria(body?.criteria)
  )
    return NextResponse.json(
      { error: "Provide a name, scope and criteria totalling 100%." },
      { status: 400 },
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table
  const { data, error } = await (supabaseAdmin as any)
    .from("review_competency_templates")
    .insert({
      name,
      scope,
      scope_value: scope === "company" ? null : scopeValue,
      criteria: body.criteria,
      created_by: session.user.id,
    })
    .select("id, name, scope, scope_value, criteria")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
