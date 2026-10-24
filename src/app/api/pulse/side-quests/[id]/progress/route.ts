import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { awardPoints } from "@/lib/award-points";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const [{ data: quest }, { data: user }] = await Promise.all([supabaseAdmin.from("side_quests").select("id, status, starts_at, ends_at, audience_type, audience_filters").eq("id", id).maybeSingle(), supabaseAdmin.from("users").select("id, department, location, manager_id").eq("id", session.user.id).maybeSingle()]);
  if (!quest || quest.status !== "live") return NextResponse.json({ error: "This Side Quest is not accepting completions." }, { status: 400 });
  const now = new Date();
  if ((quest.starts_at && new Date(quest.starts_at) > now) || (quest.ends_at && new Date(quest.ends_at) < now)) return NextResponse.json({ error: "This Side Quest is outside its completion window." }, { status: 400 });
  const filters = quest.audience_filters ?? [];
  const eligible = quest.audience_type === "company" || (quest.audience_type === "department" && Boolean(user?.department && filters.includes(user.department))) || (quest.audience_type === "location" && Boolean(user?.location && filters.includes(user.location))) || (quest.audience_type === "manager_group" && Boolean(user?.manager_id && filters.includes(user.manager_id))) || (quest.audience_type === "staff" && filters.includes(session.user.id));
  if (!eligible) return NextResponse.json({ error: "This Side Quest is not assigned to you." }, { status: 403 });
  const { error } = await supabaseAdmin.from("side_quest_completions").upsert({ side_quest_id: id, user_id: session.user.id }, { onConflict: "side_quest_id,user_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Award +10 points for quest completion (non-blocking)
  try {
    await awardPoints({
      userId: session.user.id,
      amount: 10,
      reason: `Side quest completed: ${id}`,
      referenceType: "side_quest_completion",
      referenceId: id,
      createdBy: null,
    });
  } catch { /* non-blocking */ }
  return NextResponse.json({ ok: true });
}
