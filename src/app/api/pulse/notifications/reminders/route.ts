import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  notifyQuestEndingSoon,
  notifySurveyPublished,
  notifySurveyClosingSoon,
  notifyWeeklyDigest,
} from "@/lib/notifications";
import { hasCronAccess } from "@/lib/cron-auth";
import { audienceUserIds } from "@/features/pulse/surveys/audience";
import { invalidateTables } from "@/lib/cache/invalidate";

export async function POST(req: Request): Promise<Response> {
  // Auth: Bearer CRON_SECRET
  if (!hasCronAccess(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let sent = 0;

  // ── 1. Active users (needed for surveys + digest) ─────────────────────────
  const { data: activeUsers } = await supabaseAdmin
    .from("users")
    .select("id, department, location, manager_id")
    .eq("is_active", true);

  const users = activeUsers ?? [];
  const allUserIds = users.map((u) => u.id);

  // ── 2. Scheduled surveys ────────────────────────────────────────────────
  // State changes are conditional, so each survey is launched and announced once.
  const nowIso = new Date().toISOString();
  const { data: scheduledToOpen } = await supabaseAdmin
    .from("surveys")
    .update({ status: "active" })
    .eq("status", "draft")
    .lte("opens_at", nowIso)
    .select("id,title");
  for (const survey of scheduledToOpen ?? []) {
    for (const userId of await audienceUserIds(survey.id)) {
      await notifySurveyPublished(userId, survey.title, survey.id);
      sent++;
    }
  }
  const { data: scheduledToClose } = await supabaseAdmin
    .from("surveys")
    .update({ status: "closed" })
    .eq("status", "active")
    .lte("closes_at", nowIso)
    .select("id");
  if ((scheduledToOpen?.length ?? 0) > 0 || (scheduledToClose?.length ?? 0) > 0)
    await invalidateTables("surveys");

  // ── 3. Side Quests ending within 48 h ─────────────────────────────────────
  const { data: endingQuests } = await supabaseAdmin
    .from("side_quests")
    .select("id, title, ends_at, audience_type, audience_filters")
    .eq("status", "live")
    .gte("ends_at", new Date().toISOString())
    .lte("ends_at", new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString());

  for (const quest of endingQuests ?? []) {
    const filters: string[] = Array.isArray(quest.audience_filters)
      ? quest.audience_filters
      : [];
    const eligible =
      quest.audience_type === "company"
        ? allUserIds
        : users
            .filter((u) => {
              if (quest.audience_type === "department")
                return u.department != null && filters.includes(u.department);
              if (quest.audience_type === "location")
                return u.location != null && filters.includes(u.location);
              if (quest.audience_type === "manager_group")
                return u.manager_id != null && filters.includes(u.manager_id);
              if (quest.audience_type === "staff")
                return filters.includes(u.id);
              return false;
            })
            .map((u) => u.id);

    for (const userId of eligible) {
      await notifyQuestEndingSoon(userId, quest.title, quest.ends_at!);
      sent++;
    }
  }

  // ── 4. Surveys closing within 48 h ────────────────────────────────────────
  const { data: closingSurveys } = await supabaseAdmin
    .from("surveys")
    .select("id, title, closes_at")
    .eq("status", "active")
    .gte("closes_at", new Date().toISOString())
    .lte("closes_at", new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString());

  for (const survey of closingSurveys ?? []) {
    const [{ data: participants }, { data: recentNotifications }] =
      await Promise.all([
        supabaseAdmin
          .from("survey_participants")
          .select("user_id")
          .eq("survey_id", survey.id),
        supabaseAdmin
          .from("notifications")
          .select("user_id")
          .like("message", `%${survey.title}%`)
          .gte(
            "created_at",
            new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
          ),
      ]);
    const responded = new Set(
      (participants ?? []).map((participant) => participant.user_id),
    );
    const remindedRecently = new Set(
      (recentNotifications ?? []).map((notification) => notification.user_id),
    );
    for (const userId of await audienceUserIds(survey.id)) {
      if (responded.has(userId) || remindedRecently.has(userId)) continue;
      await notifySurveyClosingSoon(userId, survey.title, survey.closes_at!);
      sent++;
    }
  }

  // ── 5. Weekly digest ──────────────────────────────────────────────────────
  // Compute Monday of the current week at 00:00 UTC.
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - daysToMonday);
  weekStart.setUTCHours(0, 0, 0, 0);
  const weekStartIso = weekStart.toISOString();

  for (const userId of allUserIds) {
    const [{ count: recognitionCount }, { count: questsCount }] =
      await Promise.all([
        supabaseAdmin
          .from("feedback_recipients")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", weekStartIso),
        supabaseAdmin
          .from("side_quest_completions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("completed_at", weekStartIso),
      ]);

    const questsCompleted = questsCount ?? 0;
    const recognitionReceived = recognitionCount ?? 0;

    if (questsCompleted > 0 || recognitionReceived > 0) {
      await notifyWeeklyDigest(userId, {
        questsCompleted,
        recognitionReceived,
      });
      sent++;
    }
  }

  return NextResponse.json({ sent });
}
