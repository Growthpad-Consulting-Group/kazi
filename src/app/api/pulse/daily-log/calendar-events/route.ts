import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listCompletedCalendarEvents } from "@/lib/google-calendar";
import { supabaseAdmin } from "@/lib/supabase";
import { isEditableLogDate, isValidLogDate } from "@/features/pulse/daily-log/constants";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const date = new URL(request.url).searchParams.get("date");
  if (!isValidLogDate(date) || !isEditableLogDate(date))
    return NextResponse.json(
      { error: "Choose an editable workday to import meetings." },
      { status: 400 },
    );

  const { data: schedule } = await (supabaseAdmin as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("staff_work_schedules")
    .select("timezone")
    .eq("user_id", session.user.id)
    .maybeSingle();
  const timeZone = schedule?.timezone ?? "Africa/Nairobi";

  try {
    const events = await listCompletedCalendarEvents(
      session.user.id,
      date,
      timeZone,
    );
    return NextResponse.json({ connected: true, events });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load calendar events.";
    if (message === "No Google Calendar connection found for this user.")
      return NextResponse.json({ connected: false, events: [] });
    console.error("Daily log calendar import failed", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
