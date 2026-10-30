import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { userCan } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { awardPoints } from "@/lib/award-points";
import { awardQuarterlyXp } from "@/lib/award-xp";
import { refreshSideQuestAchievements } from "@/lib/side-quest-achievements";

type RouteContext = { params: Promise<{ id: string; userId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, userId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
  } | null;
  if (body?.action !== "approve" && body?.action !== "reject")
    return NextResponse.json(
      { error: "Choose approve or reject." },
      { status: 400 },
    );

  const [{ data: completion }, { data: quest }] = await Promise.all([
    supabaseAdmin
      .from("side_quest_completions")
      .select("id, status")
      .eq("side_quest_id", id)
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("side_quests")
      .select("points, xp_points, approver_id")
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (!completion || !quest)
    return NextResponse.json(
      { error: "Completion not found." },
      { status: 404 },
    );
  if (
    quest.approver_id
      ? quest.approver_id !== session.user.id
      : !userCan(session.user, "manage_side_quests")
  )
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (completion.status !== "pending")
    return NextResponse.json(
      { error: "This submission has already been reviewed." },
      { status: 409 },
    );

  const status = body.action === "approve" ? "approved" : "rejected";
  const { error } = await supabaseAdmin
    .from("side_quest_completions")
    .update({
      status,
      reviewed_by: session.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", completion.id)
    .eq("status", "pending");
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  if (status === "approved")
    await awardPoints({
      userId,
      amount: quest.points,
      reason: `Side quest completed: ${id}`,
      referenceType: "side_quest_completion",
      referenceId: completion.id,
      createdBy: session.user.id,
    });
  if (status === "approved")
    await awardQuarterlyXp({
      userId,
      amount: quest.xp_points,
      reason: `Side quest completed: ${id}`,
      referenceType: "side_quest_completion",
      referenceId: completion.id,
      createdBy: session.user.id,
    });
  if (status === "approved") await refreshSideQuestAchievements(userId, id);

  return NextResponse.json({ ok: true, status });
}
