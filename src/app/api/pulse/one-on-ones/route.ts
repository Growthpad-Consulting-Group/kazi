import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateOneOnOneParticipants } from "@/lib/cache/invalidate";
import { createCalendarEvent } from "@/lib/google-calendar";
import { postSlackMessage } from "@/lib/slack";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_checkins")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { managerId, reportId, scheduledAt } = await req.json();
  if (!managerId || !reportId) {
    return NextResponse.json({ error: "managerId and reportId required" }, { status: 400 });
  }

  // Carry open action items from the most recent 1-on-1 between these two
  const { data: prev } = await supabaseAdmin
    .from("one_on_ones")
    .select("action_items")
    .eq("manager_id", managerId)
    .eq("report_id", reportId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  type ActionItem = { text: string; done: boolean; carried_from?: string };
  const prevItems = (prev as unknown as { action_items: ActionItem[] } | null)?.action_items ?? [];
  const carried: ActionItem[] = prevItems
    .filter((a) => !a.done)
    .map((a) => ({ text: a.text, done: false, carried_from: "previous session" }));

  const { data, error } = await supabaseAdmin
    .from("one_on_ones")
    .insert({
      manager_id: managerId,
      report_id: reportId,
      scheduled_at: scheduledAt ?? null,
      action_items: carried,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const insertedId = (data as unknown as { id: string }).id;

  await invalidateOneOnOneParticipants({ managerId, reportId });

  // Create Google Calendar event if scheduledAt is provided (non-blocking)
  if (scheduledAt) {
    try {
      const { data: users } = await supabaseAdmin
        .from("users")
        .select("id, name, email")
        .in("id", [managerId, reportId]);

      type UserRow = { id: string; name: string; email: string };
      const userList = (users ?? []) as UserRow[];
      const managerUser = userList.find((u) => u.id === managerId);
      const reportUser = userList.find((u) => u.id === reportId);
      const managerName = managerUser?.name ?? "Manager";
      const reportName = reportUser?.name ?? "Report";
      const attendeeEmails = userList.map((u) => u.email).filter(Boolean);

      const endAt = new Date(new Date(scheduledAt).getTime() + 60 * 60 * 1000).toISOString();

      const calResult = await createCalendarEvent(managerId, {
        title: `1-on-1: ${managerName} & ${reportName}`,
        description: "Scheduled via Kazi",
        startAt: scheduledAt,
        endAt,
        attendeeEmails,
      });

      if (calResult?.eventId) {
        await supabaseAdmin
          .from("one_on_ones")
          .update({ google_event_id: calResult.eventId })
          .eq("id", insertedId);
      }
    } catch (calErr) {
      console.error("Calendar event creation failed (non-blocking)", calErr);
    }
  }

  // Post Slack Block Kit notification if scheduledAt is provided (non-blocking)
  if (scheduledAt) {
    try {
      // We may have already fetched users inside the Calendar block above;
      // fetch again here to keep this block self-contained and independent.
      const { data: slackUsers } = await supabaseAdmin
        .from("users")
        .select("id, name")
        .in("id", [managerId, reportId]);

      type SlackUserRow = { id: string; name: string };
      const slackUserList = (slackUsers ?? []) as SlackUserRow[];
      const managerName = slackUserList.find((u) => u.id === managerId)?.name ?? "Manager";
      const reportName = slackUserList.find((u) => u.id === reportId)?.name ?? "Report";
      const formattedDate = new Date(scheduledAt).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      });
      const appUrl = process.env.PRODUCTION_APP_URL ?? "http://localhost:3000";

      await postSlackMessage(
        `@${managerName} has a 1-on-1 with @${reportName} scheduled for ${formattedDate}`,
        [
          {
            type: "header",
            text: { type: "plain_text", text: "📅 1-on-1 Scheduled" },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `@${managerName} has a 1-on-1 with @${reportName} scheduled for ${formattedDate}. <${appUrl}/pulse/one-on-ones|View 1-on-1s>`,
              },
            ],
          },
        ]
      );
    } catch (slackErr) {
      console.error("Slack notification failed (non-blocking)", slackErr);
    }
  }

  return NextResponse.json({ id: insertedId, carried: carried.length });
}
