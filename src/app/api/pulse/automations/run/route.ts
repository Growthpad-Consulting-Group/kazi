import { NextResponse } from "next/server";
import { getAutomationAudience, runAutomationEvent } from "@/lib/automations";
import { notifyCampaignLive, notifyMilestone, notifyQuestEndingSoon } from "@/lib/notifications";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const startOfDay = `${today}T00:00:00.000Z`;
  const endOfDay = `${today}T23:59:59.999Z`;
  let processed = 0;

  const { data: milestones } = await supabaseAdmin
    .from("milestones")
    .select("id, user_id, type, years_count")
    .eq("milestone_date", today)
    .in("type", ["work_anniversary", "service_achievement"]);

  for (const milestone of milestones ?? []) {
    processed += await runAutomationEvent({
      trigger: "milestone_anniversary",
      eventKey: `milestone:${milestone.id}`,
      recipientIds: [milestone.user_id],
      notification: (userId) => notifyMilestone(userId, milestone.type, milestone.years_count ?? undefined),
      pointReason: `${milestone.type.replaceAll("_", " ")} automation reward`,
      referenceId: milestone.id,
    });
  }

  const { data: campaigns } = await supabaseAdmin
    .from("recognition_campaigns")
    .select("id, name, starts_at, audience_type, audience_filters")
    .gte("starts_at", startOfDay)
    .lte("starts_at", endOfDay)
    .in("status", ["upcoming", "live"]);

  for (const campaign of campaigns ?? []) {
    const recipientIds = await getAutomationAudience(campaign.audience_type, campaign.audience_filters);
    processed += await runAutomationEvent({
      trigger: "campaign_start",
      eventKey: `campaign:${campaign.id}:start:${campaign.starts_at}`,
      recipientIds,
      notification: (userId) => notifyCampaignLive(userId, campaign.name),
      pointReason: `Campaign started: ${campaign.name}`,
      referenceId: campaign.id,
    });
  }

  const { data: quests } = await supabaseAdmin
    .from("side_quests")
    .select("id, title, ends_at, audience_type, audience_filters")
    .eq("status", "live")
    .gte("ends_at", now.toISOString())
    .lte("ends_at", new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString());

  for (const quest of quests ?? []) {
    if (!quest.ends_at) continue;
    const recipientIds = await getAutomationAudience(quest.audience_type, quest.audience_filters);
    processed += await runAutomationEvent({
      trigger: "quest_ends_soon",
      eventKey: `quest:${quest.id}:ending:${quest.ends_at}`,
      recipientIds,
      notification: (userId) => notifyQuestEndingSoon(userId, quest.title, quest.ends_at!),
      pointReason: `Side Quest ending soon: ${quest.title}`,
      referenceId: quest.id,
    });
  }

  return NextResponse.json({ ok: true, processed });
}
