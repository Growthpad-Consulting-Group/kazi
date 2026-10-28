import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { deleteCalendarEvent, updateCalendarEvent } from "@/lib/google-calendar";

type RouteContext = { params: Promise<{ id: string; interviewId: string }> };

async function getInterview(candidateId: string, interviewId: string) {
  const { data, error } = await supabaseAdmin
    .from("candidate_interviews")
    .select("id, candidate_id, scheduled_at, duration_minutes, booked_by, google_event_id")
    .eq("id", interviewId)
    .eq("candidate_id", candidateId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_hiring")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: candidateId, interviewId } = await params;
  let body: { scheduledAt?: unknown; durationMinutes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const start = new Date(typeof body.scheduledAt === "string" ? body.scheduledAt : "");
  const duration = Number(body.durationMinutes);
  if (Number.isNaN(start.getTime()) || !Number.isInteger(duration) || duration <= 0) {
    return NextResponse.json({ error: "A valid date, time and duration are required" }, { status: 400 });
  }

  try {
    const interview = await getInterview(candidateId, interviewId);
    if (!interview) return NextResponse.json({ error: "Interview not found" }, { status: 404 });

    const synced = await updateCalendarEvent(interview.booked_by, interview.google_event_id, {
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + duration * 60 * 1000).toISOString(),
    });
    if (!synced) {
      return NextResponse.json({ error: "Could not update the Google Calendar event. Check the organiser's calendar connection and try again." }, { status: 502 });
    }

    const { data, error } = await supabaseAdmin
      .from("candidate_interviews")
      .update({ scheduled_at: start.toISOString(), duration_minutes: duration })
      .eq("id", interviewId)
      .eq("candidate_id", candidateId)
      .select("id, scheduled_at, duration_minutes")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ interview: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not reschedule the interview" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_hiring")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: candidateId, interviewId } = await params;
  try {
    const interview = await getInterview(candidateId, interviewId);
    if (!interview) return NextResponse.json({ error: "Interview not found" }, { status: 404 });

    const synced = await deleteCalendarEvent(interview.booked_by, interview.google_event_id);
    if (!synced) {
      return NextResponse.json({ error: "Could not cancel the Google Calendar event. Check the organiser's calendar connection and try again." }, { status: 502 });
    }

    const { error } = await supabaseAdmin
      .from("candidate_interviews")
      .delete()
      .eq("id", interviewId)
      .eq("candidate_id", candidateId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not cancel the interview" }, { status: 500 });
  }
}
