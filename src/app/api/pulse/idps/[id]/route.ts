import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";
import type { Database, IdpStatus } from "@/types/database";

type RouteContext = { params: Promise<{ id: string }> };
type PlanAccess = { user_id: string; manager_id: string | null };

const STATUSES: IdpStatus[] = ["active", "completed", "cancelled"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function loadPlan(id: string) {
  const { data } = await supabaseAdmin
    .from("idps")
    .select("user_id, manager_id")
    .eq("id", id)
    .maybeSingle();
  return data as PlanAccess | null;
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const plan = await loadPlan(id);
  if (!plan)
    return NextResponse.json({ error: "Plan not found." }, { status: 404 });
  const isOwner = plan.user_id === session.user.id;
  const isManager =
    plan.manager_id === session.user.id ||
    can(session.user.role, "manage_idps");
  if (!isOwner && !isManager)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body)
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const update: Database["public"]["Tables"]["idps"]["Update"] = {};
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim())
      return NextResponse.json(
        { error: "A plan needs a title." },
        { status: 400 },
      );
    update.title = body.title.trim().slice(0, 200);
  }
  if (body.goals !== undefined)
    update.goals =
      typeof body.goals === "string" && body.goals.trim()
        ? body.goals.trim()
        : null;
  if (body.actions !== undefined) {
    if (!Array.isArray(body.actions))
      return NextResponse.json(
        { error: "Actions must be a list." },
        { status: 400 },
      );
    update.actions = body.actions;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as IdpStatus))
      return NextResponse.json(
        { error: "Choose a valid status." },
        { status: 400 },
      );
    update.status = body.status as IdpStatus;
  }
  for (const key of ["start_date", "due_date"] as const) {
    if (body[key] === undefined) continue;
    const value =
      typeof body[key] === "string" && body[key] ? (body[key] as string) : null;
    if (value && !DATE.test(value))
      return NextResponse.json(
        { error: "Dates must be valid." },
        { status: 400 },
      );
    update[key] = value;
  }
  if (
    update.start_date &&
    update.due_date &&
    (update.due_date as string) < (update.start_date as string)
  ) {
    return NextResponse.json(
      { error: "The target date must be on or after the start date." },
      { status: 400 },
    );
  }
  if (!Object.keys(update).length)
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("idps")
    .update(update)
    .eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateTables("idps");
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const plan = await loadPlan(id);
  if (!plan)
    return NextResponse.json({ error: "Plan not found." }, { status: 404 });
  const canDelete =
    plan.manager_id === session.user.id ||
    can(session.user.role, "manage_idps");
  if (!canDelete)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabaseAdmin.from("idps").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateTables("idps");
  return NextResponse.json({ ok: true });
}
