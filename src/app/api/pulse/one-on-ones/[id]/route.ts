import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateOneOnOneParticipants } from "@/lib/cache/invalidate";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/lib/google-calendar";
import { postSlackMessage } from "@/lib/slack";

type UserRow = { id: string; name: string; email: string };

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { agenda, notes, action_items, scheduledAt } = await req.json();

  type OooUpdate = {
    agenda?: string | null;
    notes?: string | null;
    action_items?: { text: string; done: boolean; carried_from?: string }[];
    scheduled_at?: string | null;
  };
  const update: OooUpdate = {};
  if (agenda !== undefined) update.agenda = agenda;
  if (notes !== undefined) update.notes = notes;
  if (action_items !== undefined) update.action_items = action_items;
  if (scheduledAt !== undefined) update.scheduled_at = scheduledAt;

  // Read existing row before write
  const { data: existing } = await supabaseAdmin
    .from("one_on_ones")
    .select("manager_id, report_id, google_event_id")
    .eq("id", id)
    .maybeSingle();

  const participants = existing as unknown as {
    manager_id: string | null;
    report_id: string | null;
    google_event_id: string | null;
  } | null;

  const { error } = await supabaseAdmin.from("one_on_ones").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await invalidateOneOnOneParticipants({
    managerId: participants?.manager_id ?? undefined,
    reportId: participants?.report_id ?? undefined,
  });

  // Calendar sync (non-blocking)
  if (scheduledAt !== undefined && participants?.manager_id) {
    try {
      const managerId = participants.manager_id;
      const reportId = participants.report_id ?? "";

      if (participants.google_event_id) {
        // Update existing event
        const endAt = scheduledAt
          ? new Date(new Date(scheduledAt).getTime() + 60 * 60 * 1000).toISOString()
          : undefined;
        await updateCalendarEvent(managerId, participants.google_event_id, {
          startAt: scheduledAt ?? undefined,
          endAt,
        });
      } else if (scheduledAt) {
        // Create new event and store eventId
        const { data: users } = await supabaseAdmin
          .from("users")
          .select("id, name, email")
          .in("id", [managerId, reportId].filter(Boolean));

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
            .eq("id", id);
        }
      }
    } catch (calErr) {
      console.error("Calendar event update failed (non-blocking)", calErr);
    }
  }

  // Slack notification (non-blocking)
  if (scheduledAt !== undefined && scheduledAt && participants?.manager_id) {
    try {
      const managerId = participants.manager_id;
      const reportId = participants.report_id ?? "";

      const { data: slackUsers } = await supabaseAdmin
        .from("users")
        .select("id, name")
        .in("id", [managerId, reportId].filter(Boolean));

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

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Fetch existing row to get manager_id, report_id, google_event_id
  const { data: existing } = await supabaseAdmin
    .from("one_on_ones")
    .select("manager_id, report_id, google_event_id")
    .eq("id", id)
    .maybeSingle();

  const row = existing as unknown as {
    manager_id: string | null;
    report_id: string | null;
    google_event_id: string | null;
  } | null;

  // Delete calendar event if present (non-blocking)
  if (row?.google_event_id && row?.manager_id) {
    try {
      await deleteCalendarEvent(row.manager_id, row.google_event_id);
    } catch (calErr) {
      console.error("Calendar event deletion failed (non-blocking)", calErr);
    }
  }

  const { error } = await supabaseAdmin.from("one_on_ones").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
