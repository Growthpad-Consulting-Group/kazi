import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateOwnerGoals } from "@/lib/cache/invalidate";
import {
  canCreateGoalLevel,
  canAlignToParentGoal,
  isDirectReport,
} from "@/lib/goal-permissions";
import type { Goal, GoalLevel } from "@/types/database";

const LEVELS: GoalLevel[] = ["company", "team", "individual"];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    title?: unknown;
    description?: unknown;
    level?: unknown;
    owner_id?: unknown;
    parent_id?: unknown;
    due_date?: unknown;
    target_value?: unknown;
    current_value?: unknown;
    target_unit?: unknown;
  } | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const level = body?.level;
  if (!title || !level)
    return NextResponse.json(
      { error: "title and level required" },
      { status: 400 },
    );
  if (title.length > 200)
    return NextResponse.json(
      { error: "A title up to 200 characters is required." },
      { status: 400 },
    );

  if (!LEVELS.includes(level as GoalLevel))
    return NextResponse.json(
      { error: "Choose a valid scope." },
      { status: 400 },
    );
  const goalLevel = level as GoalLevel;
  if (!canCreateGoalLevel(session.user.role, goalLevel))
    return NextResponse.json(
      { error: "You cannot create a goal at this scope." },
      { status: 403 },
    );

  const ownerId =
    typeof body?.owner_id === "string" && body.owner_id ? body.owner_id : null;
  if (level === "individual" && !ownerId)
    return NextResponse.json(
      { error: "Choose an owner for an individual goal." },
      { status: 400 },
    );
  if (
    !["admin", "hr", "manager"].includes(session.user.role) &&
    ownerId !== session.user.id
  )
    return NextResponse.json(
      { error: "You can create individual goals only for yourself." },
      { status: 403 },
    );
  if (
    session.user.role === "manager" &&
    goalLevel === "individual" &&
    !(await isDirectReport(session.user.id, ownerId!))
  )
    return NextResponse.json(
      { error: "Choose yourself or one of your direct reports." },
      { status: 403 },
    );

  const parentId =
    typeof body?.parent_id === "string" && body.parent_id
      ? body.parent_id
      : null;
  if (goalLevel === "company" && parentId)
    return NextResponse.json(
      { error: "Company goals cannot be nested under another goal." },
      { status: 400 },
    );
  if (parentId) {
    const { data: parent } = await supabaseAdmin
      .from("goals")
      .select("id, level, owner_id, created_by")
      .eq("id", parentId)
      .maybeSingle();
    const parentGoal = parent as Pick<
      Goal,
      "id" | "level" | "owner_id" | "created_by"
    > | null;
    if (!parentGoal)
      return NextResponse.json(
        { error: "Parent goal not found." },
        { status: 404 },
      );
    if (
      (goalLevel === "team" && parentGoal.level !== "company") ||
      (goalLevel === "individual" && parentGoal.level === "individual")
    )
      return NextResponse.json(
        { error: "Choose a parent goal at the next highest scope." },
        { status: 400 },
      );
    if (
      !(await canAlignToParentGoal(
        { id: session.user.id, role: session.user.role },
        parentGoal,
      ))
    )
      return NextResponse.json(
        { error: "You cannot align a goal to that parent goal." },
        { status: 403 },
      );
  }

  const targetValue =
    typeof body?.target_value === "number" &&
    Number.isFinite(body.target_value) &&
    body.target_value > 0
      ? body.target_value
      : null;
  const currentValue =
    typeof body?.current_value === "number" &&
    Number.isFinite(body.current_value)
      ? body.current_value
      : null;
  if (
    body?.target_value !== undefined &&
    body.target_value !== null &&
    !targetValue
  )
    return NextResponse.json(
      { error: "A target must be greater than zero." },
      { status: 400 },
    );
  if (currentValue !== null && !targetValue)
    return NextResponse.json(
      { error: "Set a target before entering the current value." },
      { status: 400 },
    );
  const targetUnit =
    typeof body?.target_unit === "string" && body.target_unit.trim()
      ? body.target_unit.trim().slice(0, 40)
      : null;

  const { error } = await supabaseAdmin.from("goals").insert({
    title,
    description:
      typeof body?.description === "string" && body.description.trim()
        ? body.description.trim()
        : null,
    level: goalLevel,
    owner_id: ownerId,
    parent_id: parentId,
    due_date:
      typeof body?.due_date === "string" && body.due_date
        ? body.due_date
        : null,
    target_value: targetValue,
    current_value: currentValue,
    target_unit: targetUnit,
    progress:
      targetValue && currentValue !== null
        ? Math.max(
            0,
            Math.min(100, Math.round((currentValue / targetValue) * 100)),
          )
        : undefined,
    created_by: session.user.id,
  });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateOwnerGoals(ownerId ?? "");
  return NextResponse.json({ ok: true });
}
