import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateUserCheckins } from "@/lib/cache/invalidate";
import { deliverSlackNotification } from "@/lib/slack";
import { remindLaterButton } from "@/lib/slack-digests";
import { notifyManagerOfCheckin } from "@/lib/notifications";
import type { CheckinStatus } from "@/types/database";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, weekStart, wins, priorities, blockers, mood, status } =
    await req.json();

  // Users can only update their own check-in (unless admin/hr)
  if (
    userId !== session.user.id &&
    !["admin", "hr"].includes(session.user.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data: existing } = await supabaseAdmin
    .from("checkins")
    .select("status")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (existing?.status === "reviewed" && userId === session.user.id) {
    return NextResponse.json(
      {
        error:
          "This check-in has already been reviewed and can no longer be changed.",
      },
      { status: 409 },
    );
  }

  const { error } = await supabaseAdmin.from("checkins").upsert(
    {
      user_id: userId,
      week_start: weekStart,
      wins: wins ?? null,
      priorities: priorities ?? null,
      blockers: blockers ?? null,
      mood: mood ?? null,
      status: (status ?? "draft") as CheckinStatus,
    },
    { onConflict: "user_id,week_start" },
  );

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateUserCheckins(userId);
  if (status === "submitted" && existing?.status !== "submitted") {
    // Send the check-in privately to the assigned manager; company-wide
    // channels must never receive employee progress, mood, or blockers.
    try {
      const { data: userRow } = await supabaseAdmin
        .from("users")
        .select("name, manager_id")
        .eq("id", userId)
        .maybeSingle();
      const employee = userRow as unknown as {
        name: string;
        manager_id: string | null;
      } | null;
      if (!employee?.manager_id) return NextResponse.json({ ok: true });
      const { data: manager } = await supabaseAdmin
        .from("users")
        .select("id, name, email")
        .eq("id", employee.manager_id)
        .eq("is_active", true)
        .maybeSingle();
      if (!manager) return NextResponse.json({ ok: true });
      const weekLabel = new Date(weekStart).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
      const appUrl = process.env.PRODUCTION_APP_URL ?? "http://localhost:3000";
      const hasBlockers = Boolean(
        typeof blockers === "string" && blockers.trim(),
      );
      const needsManagerAttention =
        hasBlockers || (typeof mood === "number" && mood <= 2);
      await Promise.all([
        deliverSlackNotification({
          eventKey: `checkin-submitted:${userId}:${weekStart}:manager:${manager.id}`,
          recipientUserId: manager.id,
          category: "checkin_submitted",
          critical: needsManagerAttention,
          text: `${employee.name} submitted their weekly check-in for the week of ${weekLabel}`,
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: needsManagerAttention
                  ? "Action needed: Weekly Check-in"
                  : "Weekly Check-in Ready",
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${employee.name}* submitted their weekly check-in for the week of ${weekLabel}.\n*Blockers:* ${hasBlockers ? "Flagged" : "None reported"}${mood ? ` · *Mood:* ${mood}` : ""}`,
              },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `<${appUrl}/pulse/checkins?user=${userId}|Review check-in in Kazi>`,
                },
              ],
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  action_id: "mark_checkin_reviewed",
                  text: { type: "plain_text", text: "Mark reviewed" },
                  value: `${userId}|${weekStart}`,
                },
                remindLaterButton("checkin_review", `${userId}|${weekStart}`),
              ],
            },
          ],
        }),
        notifyManagerOfCheckin(manager.id, employee.name, userId, hasBlockers),
      ]);
    } catch (slackErr) {
      console.error("Slack notification failed (non-blocking)", slackErr);
    }
  }
  return NextResponse.json({ ok: true });
}
