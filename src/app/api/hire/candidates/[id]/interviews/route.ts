import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { createCalendarEvent } from "@/lib/google-calendar";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_hiring")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { scheduledAt, durationMinutes, interviewerIds } = await req.json();
  const start = new Date(scheduledAt);
  const duration = Number(durationMinutes);
  if (Number.isNaN(start.getTime()) || !Number.isInteger(duration) || duration <= 0) {
    return NextResponse.json({ error: "A valid date, time and duration are required" }, { status: 400 });
  }
  const interviewers = Array.isArray(interviewerIds) ? interviewerIds.filter((v): v is string => typeof v === "string") : [];
  if (!interviewers.includes(session.user.id)) interviewers.unshift(session.user.id);

  const { data: candidate } = await supabaseAdmin
    .from("candidates")
    .select("id, full_name, email, stage, jobs(title)")
    .eq("id", id)
    .maybeSingle();
  const row = candidate as unknown as {
    id: string; full_name: string; email: string; stage: string; jobs: { title: string } | null;
  } | null;
  if (!row) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  if (row.stage !== "interview") {
    return NextResponse.json({ error: "Interviews can only be booked when the candidate is in the Interview stage" }, { status: 409 });
  }

  const { data: interviewerRows } = await supabaseAdmin
    .from("users")
    .select("id, email")
    .in("id", interviewers)
    .eq("is_active", true);
  const interviewerEmails = ((interviewerRows ?? []) as { id: string; email: string }[]).map((u) => u.email);
  const attendeeEmails = [...new Set([row.email, ...interviewerEmails].filter(Boolean))];
  const calendarEvent = await createCalendarEvent(session.user.id, {
    title: `Interview: ${row.full_name}${row.jobs?.title ? ` (${row.jobs.title})` : ""}`,
    description: "Scheduled via Kazi",
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + duration * 60 * 1000).toISOString(),
    attendeeEmails,
  });
  if (!calendarEvent?.eventId) {
    return NextResponse.json(
      { error: "Could not create the Google Calendar event. Connect Google Calendar in Settings > Integrations and try again." },
      { status: 422 }
    );
  }

  const { data, error } = await (supabaseAdmin as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("candidate_interviews")
    .insert({
      candidate_id: row.id,
      scheduled_at: start.toISOString(),
      duration_minutes: duration,
      booked_by: session.user.id,
      interviewer_ids: interviewers,
      google_event_id: calendarEvent.eventId,
    })
    .select("id, scheduled_at, duration_minutes")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ interview: data }, { status: 201 });
}
