import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { awardPoints } from "@/lib/award-points";

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
        "id, status, starts_at, ends_at, audience_type, audience_filters, points, completion_mode",
      )
      .eq("id", id)
      .maybeSingle(),
    supabaseAdmin
      .from("users")
      .select("id, department, location, manager_id")
      .eq("id", session.user.id)
      .maybeSingle(),
  ]);
  if (!quest || quest.status !== "live")
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
    !evidenceUrl
  )
    return NextResponse.json(
      { error: "Add a short note or evidence link before submitting." },
      { status: 400 },
    );
  const completionStatus =
    quest.completion_mode === "self_confirm" ? "approved" : "pending";
  const { error } = await supabaseAdmin.from("side_quest_completions").insert({
    side_quest_id: id,
    user_id: session.user.id,
    status: completionStatus,
    evidence_note: evidenceNote || null,
    evidence_url: evidenceUrl || null,
  });
  if (error?.code === "23505")
    return NextResponse.json(
      { error: "You have already submitted this Side Quest." },
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
      referenceId: id,
      createdBy: null,
    });
  }
  return NextResponse.json({ ok: true, status: completionStatus });
}
