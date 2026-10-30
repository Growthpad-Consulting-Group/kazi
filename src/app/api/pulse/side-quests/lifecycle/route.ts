import { NextResponse } from "next/server";
import { hasCronAccess } from "@/lib/cron-auth";
import { getAutomationAudience } from "@/lib/automations";
import { notifyQuestLive } from "@/lib/notifications";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!hasCronAccess(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date().toISOString();
  const [
    { data: opened, error: openError },
    { data: closed, error: closeError },
  ] = await Promise.all([
    supabaseAdmin
      .from("side_quests")
      .update({ status: "live" })
      .eq("status", "upcoming")
      .lte("starts_at", now)
      .select("id, title, audience_type, audience_filters"),
    supabaseAdmin
      .from("side_quests")
      .update({ status: "closed" })
      .eq("status", "live")
      .lt("ends_at", now)
      .select("id"),
  ]);
  if (openError || closeError)
    return NextResponse.json(
      { error: openError?.message ?? closeError?.message },
      { status: 500 },
    );
  for (const quest of opened ?? []) {
    const recipients = await getAutomationAudience(
      quest.audience_type,
      quest.audience_filters,
    );
    const { data: preferences } = await supabaseAdmin
      .from("engagement_notification_preferences")
      .select("user_id, side_quest_updates")
      .in("user_id", recipients);
    const optedOut = new Set(
      (preferences ?? [])
        .filter((preference) => !preference.side_quest_updates)
        .map((preference) => preference.user_id),
    );
    await Promise.all(
      recipients
        .filter((userId) => !optedOut.has(userId))
        .map((userId) => notifyQuestLive(userId, quest.title)),
    );
  }
  return NextResponse.json({
    opened: opened?.length ?? 0,
    closed: closed?.length ?? 0,
  });
}
