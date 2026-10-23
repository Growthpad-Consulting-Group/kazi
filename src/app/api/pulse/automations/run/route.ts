import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { notifyMilestone, notifyCampaignLive } from "@/lib/notifications";
import { awardPoints } from "@/lib/award-points";

export async function POST(req: Request): Promise<Response> {
  // Auth: Bearer CRON_SECRET
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  let processed = 0;

  // Fetch active automation rules
  const { data: rules } = await supabaseAdmin
    .from("automation_rules")
    .select("*")
    .eq("is_active", true);

  for (const rule of rules ?? []) {
    // ── Milestone anniversary → send notification ─────────────────────────
    if (rule.trigger_type === "milestone_anniversary" && rule.action_type === "send_notification") {
      const { data: milestones } = await supabaseAdmin
        .from("milestones")
        .select("user_id, years_count")
        .eq("milestone_date", todayStr)
        .eq("type", "work_anniversary");

      for (const milestone of milestones ?? []) {
        await notifyMilestone(milestone.user_id, "work_anniversary", milestone.years_count ?? undefined);
        processed++;
      }

      // service achievements
      const { data: svcMilestones } = await supabaseAdmin
        .from("milestones")
        .select("user_id, years_count")
        .eq("milestone_date", todayStr)
        .eq("type", "service_achievement");

      for (const milestone of svcMilestones ?? []) {
        await notifyMilestone(milestone.user_id, "service_achievement", milestone.years_count ?? undefined);
        processed++;
      }
    }

    // ── Milestone anniversary / service achievement → award points ────────
    if (rule.trigger_type === "milestone_anniversary" && rule.action_type === "award_points") {
      const pts = Number((rule.config as Record<string, unknown>)?.points ?? 50);
      for (const type of ["work_anniversary", "service_achievement"] as const) {
        const { data: milestones } = await supabaseAdmin
          .from("milestones")
          .select("user_id, years_count")
          .eq("milestone_date", todayStr)
          .eq("type", type);

        for (const milestone of milestones ?? []) {
          try {
            await awardPoints({
              userId: milestone.user_id,
              amount: pts,
              reason: `${type.replaceAll("_", " ")} award`,
              referenceType: "milestone",
              referenceId: milestone.user_id,
              createdBy: null,
            });
          } catch { /* non-blocking */ }
          processed++;
        }
      }
    }

    // ── Campaign start → send notification ───────────────────────────────
    if (rule.trigger_type === "campaign_start" && rule.action_type === "send_notification") {
      const dayStart = `${todayStr}T00:00:00.000Z`;
      const dayEnd = `${todayStr}T23:59:59.999Z`;

      const { data: campaigns } = await supabaseAdmin
        .from("recognition_campaigns")
        .select("id, name")
        .gte("starts_at", dayStart)
        .lte("starts_at", dayEnd)
        .in("status", ["upcoming", "live"] as const);

      if (campaigns?.length) {
        const { data: users } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("is_active", true);

        for (const campaign of campaigns) {
          for (const user of users ?? []) {
            await notifyCampaignLive(user.id, campaign.name);
            processed++;
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true, processed });
}
