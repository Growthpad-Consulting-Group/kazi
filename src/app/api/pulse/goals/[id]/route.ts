import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateOwnerGoals } from "@/lib/cache/invalidate";
import { canManageGoal } from "@/lib/goal-permissions";
import type { Goal, GoalLevel } from "@/types/database";

const LEVELS: GoalLevel[] = ["company", "team", "individual"];

type RouteContext = { params: Promise<{ id: string }> };

async function goalForPermission(id: string) {
  const { data } = await supabaseAdmin
    .from("goals")
    .select("owner_id, level, created_by")
    .eq("id", id)
    .maybeSingle();
  return data as Pick<Goal, "owner_id" | "level" | "created_by"> | null;
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const goal = await goalForPermission(id);
  if (!goal)
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  if (
    !(await canManageGoal(
      { id: session.user.id, role: session.user.role },
      goal,
    ))
  )
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as {
    title?: unknown;
    description?: unknown;
    level?: unknown;
    due_date?: unknown;
  } | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 200)
    return NextResponse.json(
      { error: "A title up to 200 characters is required" },
      { status: 400 },
    );
  if (body?.level !== undefined && !LEVELS.includes(body.level as GoalLevel)) {
    return NextResponse.json(
      { error: "Choose a valid scope" },
      { status: 400 },
    );
  }
  if (body?.level !== undefined && body.level !== goal.level)
    return NextResponse.json(
      { error: "Goal scope cannot be changed after creation." },
      { status: 400 },
    );

  const { error } = await supabaseAdmin
    .from("goals")
    .update({
      title,
      description:
        typeof body?.description === "string" && body.description.trim()
          ? body.description.trim()
          : null,
      due_date:
        typeof body?.due_date === "string" && body.due_date
          ? body.due_date
          : null,
    })
    .eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  await invalidateOwnerGoals(goal.owner_id ?? "");
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const goal = await goalForPermission(id);
  if (!goal)
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  if (
    !(await canManageGoal(
      { id: session.user.id, role: session.user.role },
      goal,
    ))
  )
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { error } = await supabaseAdmin.from("goals").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  await invalidateOwnerGoals(goal.owner_id ?? "");
  return NextResponse.json({ ok: true });
}
