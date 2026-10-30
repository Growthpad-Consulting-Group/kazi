import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { awardPoints } from "@/lib/award-points";
import { awardQuarterlyXp } from "@/lib/award-xp";
import { refreshSideQuestAchievements } from "@/lib/side-quest-achievements";
import { isSideQuestOpen } from "@/lib/side-quest-lifecycle";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const [{ data: quest }, { data: user }] = await Promise.all([
    supabaseAdmin
      .from("side_quests")
      .select(
        "id, status, starts_at, ends_at, audience_type, audience_filters, points, xp_points, completion_mode, repeat_frequency, max_completions_per_period",
      )
      .eq("id", id)
      .maybeSingle(),
    supabaseAdmin
      .from("users")
      .select("id, department, location, manager_id")
      .eq("id", session.user.id)
      .maybeSingle(),
  ]);
  if (!quest || !isSideQuestOpen(quest))
    return NextResponse.json(
      { error: "This Side Quest is not accepting completions." },
      { status: 400 },
    );
  const now = new Date();
  if (
    (quest.starts_at && new Date(quest.starts_at) > now) ||
    (quest.ends_at && new Date(quest.ends_at) < now)
  )
    return NextResponse.json(
      { error: "This Side Quest is outside its completion window." },
      { status: 400 },
    );
  const filters = quest.audience_filters ?? [];
  const eligible =
    quest.audience_type === "company" ||
    (quest.audience_type === "department" &&
      Boolean(user?.department && filters.includes(user.department))) ||
    (quest.audience_type === "location" &&
      Boolean(user?.location && filters.includes(user.location))) ||
    (quest.audience_type === "manager_group" &&
      Boolean(user?.manager_id && filters.includes(user.manager_id))) ||
    (quest.audience_type === "staff" && filters.includes(session.user.id));
  if (!eligible)
    return NextResponse.json(
      { error: "This Side Quest is not assigned to you." },
      { status: 403 },
    );
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const evidenceNote =
    typeof body.evidence_note === "string" ? body.evidence_note.trim() : "";
  const evidenceUrl =
    typeof body.evidence_url === "string" ? body.evidence_url.trim() : "";
  const evidenceFileUrl =
    typeof body.evidence_file_url === "string"
      ? body.evidence_file_url.trim()
      : "";
  if (evidenceUrl) {
    try {
      const url = new URL(evidenceUrl);
      if (!/^https?:$/.test(url.protocol)) throw new Error("Invalid protocol");
    } catch {
      return NextResponse.json(
        { error: "Add a valid evidence link starting with https://." },
        { status: 400 },
      );
    }
  }
  if (
    quest.completion_mode === "evidence_required" &&
    !evidenceNote &&
    !evidenceUrl &&
    !evidenceFileUrl
  )
    return NextResponse.json(
      { error: "Add a short note or evidence link before submitting." },
      { status: 400 },
    );
  const completionStatus =
    quest.completion_mode === "self_confirm" ? "approved" : "pending";
  const frequency = quest.repeat_frequency ?? "once";
  const periodStart = new Date();
  if (frequency === "once") periodStart.setTime(0);
  else if (frequency === "weekly") {
    const day = periodStart.getUTCDay() || 7;
    periodStart.setUTCDate(periodStart.getUTCDate() - day + 1);
    periodStart.setUTCHours(0, 0, 0, 0);
  } else {
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);
  }
  const periodKey = periodStart.toISOString().slice(0, 10);
  const { count } = await supabaseAdmin
    .from("side_quest_completions")
    .select("id", { count: "exact", head: true })
    .eq("side_quest_id", id)
    .eq("user_id", session.user.id)
    .eq("period_key", periodKey);
  const maxCompletions = quest.max_completions_per_period ?? 1;
  if ((count ?? 0) >= maxCompletions)
    return NextResponse.json(
      {
        error: `You have reached this ${frequency === "once" ? "quest's" : `${frequency}`} completion limit.`,
      },
      { status: 409 },
    );
  const { data: completion, error } = await supabaseAdmin
    .from("side_quest_completions")
    .insert({
      side_quest_id: id,
      user_id: session.user.id,
      status: completionStatus,
      evidence_note: evidenceNote || null,
      evidence_url: evidenceUrl || null,
      evidence_file_url: evidenceFileUrl || null,
      period_key: periodKey,
      completion_sequence: (count ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error?.code === "23505")
    return NextResponse.json(
      { error: "This completion was already recorded. Refresh and try again." },
      { status: 409 },
    );
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (completionStatus === "approved") {
    await awardPoints({
      userId: session.user.id,
      amount: quest.points,
      reason: `Side quest completed: ${id}`,
      referenceType: "side_quest_completion",
      referenceId: completion.id,
      createdBy: null,
    });
    await awardQuarterlyXp({
      userId: session.user.id,
      amount: quest.xp_points,
      reason: `Side quest completed: ${id}`,
      referenceType: "side_quest_completion",
      referenceId: completion.id,
      createdBy: null,
    });
    await refreshSideQuestAchievements(session.user.id, id);
  }
  return NextResponse.json({ ok: true, status: completionStatus });
}
