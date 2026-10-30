import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateOwnerGoals } from "@/lib/cache/invalidate";
import { postSlackMessage } from "@/lib/slack";
import { canManageGoal } from "@/lib/goal-permissions";
import type { GoalStatus } from "@/types/database";

const GOAL_STATUSES: GoalStatus[] = [
  "not_started",
  "in_progress",
  "at_risk",
  "completed",
  "cancelled",
];

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    id?: unknown;
    progress?: unknown;
    status?: unknown;
    current_value?: unknown;
  } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const update: {
    progress?: number;
    status?: GoalStatus;
    current_value?: number;
  } = {};
  if (body?.progress !== undefined) {
    if (typeof body.progress !== "number" || !Number.isFinite(body.progress))
      return NextResponse.json(
        { error: "Progress must be a number." },
        { status: 400 },
      );
    update.progress = Math.max(0, Math.min(100, body.progress));
  }
  if (body?.status !== undefined) {
    if (!GOAL_STATUSES.includes(body.status as GoalStatus))
      return NextResponse.json(
        { error: "Choose a valid status." },
        { status: 400 },
      );
    update.status = body.status as GoalStatus;
  }
  // Read the owner (and parent) before the write so the right cached lists
  // can be dropped afterwards.
  const { data: existing } = await supabaseAdmin
    .from("goals")
    .select("owner_id, parent_id, title, level, created_by, target_value")
    .eq("id", id)
    .maybeSingle();
  const before = existing as unknown as {
    owner_id: string | null;
    parent_id: string | null;
    title: string;
    level: "company" | "team" | "individual";
    created_by: string;
    target_value: number | null;
  } | null;
  if (!before)
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  if (
    !(await canManageGoal(
      { id: session.user.id, role: session.user.role },
      before,
    ))
  )
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (body?.current_value !== undefined) {
    if (
      typeof body.current_value !== "number" ||
      !Number.isFinite(body.current_value) ||
      !before.target_value
    )
      return NextResponse.json(
        {
          error:
            "A valid metric target is required to update the current value.",
        },
        { status: 400 },
      );
    update.current_value = body.current_value;
    update.progress = Math.max(
      0,
      Math.min(
        100,
        Math.round((body.current_value / before.target_value) * 100),
      ),
    );
  }
  if (!Object.keys(update).length)
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  const ownerId = before?.owner_id ?? "";
  const parentId = before?.parent_id ?? null;
  const goalTitle = before?.title ?? "a goal";

  const { error } = await supabaseAdmin
    .from("goals")
    .update(update)
    .eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  // Roll up progress to parent if this goal has one
  if (parentId) {
    const { data: siblings } = await supabaseAdmin
      .from("goals")
      .select("progress")
      .eq("parent_id", parentId);
    const sibs = (siblings ?? []) as unknown as { progress: number }[];
    if (sibs.length) {
      const avg = Math.round(
        sibs.reduce((sum, s) => sum + s.progress, 0) / sibs.length,
      );
      await supabaseAdmin
        .from("goals")
        .update({ progress: avg })
        .eq("id", parentId);
    }
  }

  await invalidateOwnerGoals(ownerId);
  // The parent goal's progress changed too — its owner may differ.
  if (parentId) {
    const { data: parent } = await supabaseAdmin
      .from("goals")
      .select("owner_id")
      .eq("id", parentId)
      .maybeSingle();
    await invalidateOwnerGoals(
      (parent as unknown as { owner_id: string | null } | null)?.owner_id ?? "",
    );
  }

  // Slack Block Kit notification when a goal is completed (non-blocking)
  if (update.status === "completed" && ownerId) {
    try {
      const { data: userRow } = await supabaseAdmin
        .from("users")
        .select("name")
        .eq("id", ownerId)
        .maybeSingle();
      const ownerName =
        (userRow as unknown as { name: string } | null)?.name ?? "Someone";
      const appUrl = process.env.PRODUCTION_APP_URL ?? "http://localhost:3000";

      await postSlackMessage(
        `🎯 ${ownerName} just completed their goal: ${goalTitle}`,
        [
          {
            type: "header",
            text: { type: "plain_text", text: "🎯 Goal Completed" },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${ownerName}* just completed their goal: *${goalTitle}*`,
            },
          },
          {
            type: "context",
            elements: [
              { type: "mrkdwn", text: `<${appUrl}/pulse/goals|View in Kazi>` },
            ],
          },
        ],
      );
    } catch (slackErr) {
      console.error("Slack notification failed (non-blocking)", slackErr);
    }
  }

  return NextResponse.json({ ok: true });
}
