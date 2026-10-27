import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { isValidLogDate } from "@/features/pulse/daily-log/constants";
import { canActOnDailyLog } from "@/features/pulse/daily-log/access";

type Action = "acknowledge" | "nudge" | "blocker";
const ACTIONS: Action[] = ["acknowledge", "nudge", "blocker"];
const NUDGE_COOLDOWN_MS = 12 * 60 * 60 * 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the log and notification columns are newer than the generated types
const db = supabaseAdmin as any;

/** Manager actions on an employee's daily log: acknowledge a day, nudge a blank day, or send a blocker to the next 1-on-1. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { action?: string; userId?: string; date?: string } | null;
  const action = ACTIONS.find((value) => value === body?.action);
  if (!action || typeof body?.userId !== "string" || !isValidLogDate(body?.date)) {
    return NextResponse.json({ error: "Choose an action, a person and a date" }, { status: 400 });
  }
  const { userId, date } = { userId: body.userId, date: body.date };
  if (!(await canActOnDailyLog(session, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (action === "acknowledge") {
    const { data, error } = await db
      .from("daily_activity_logs")
      .update({ acknowledged_by: session.user.id, acknowledged_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("log_date", date)
      .select("user_id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) return NextResponse.json({ error: "There is no log for that day yet." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (action === "nudge") {
    const { data: log } = await db.from("daily_activity_logs").select("entries").eq("user_id", userId).eq("log_date", date).maybeSingle();
    if ((log as { entries: unknown[] } | null)?.entries?.length) {
      return NextResponse.json({ error: "They have already logged that day." }, { status: 400 });
    }
    // One nudge per person every 12 hours, so the reminder doesn't turn into noise.
    const since = new Date(Date.now() - NUDGE_COOLDOWN_MS).toISOString();
    const { data: recent } = await db.from("notifications").select("id").eq("user_id", userId).like("message", "%log today%").gte("created_at", since).limit(1);
    if (recent?.length) return NextResponse.json({ error: "You nudged them recently. Try again later." }, { status: 429 });
    const { error } = await db.from("notifications").insert({
      user_id: userId,
      message: `${session.user.name} asked you to log today's activity.`,
      link: "/pulse/checkins?tab=daily",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // blocker: copy the day's blockers into the next 1-on-1 agenda between this manager and the employee.
  const { data: log } = await db.from("daily_activity_logs").select("blockers").eq("user_id", userId).eq("log_date", date).maybeSingle();
  const blockers = (log as { blockers: string | null } | null)?.blockers?.trim();
  if (!blockers) return NextResponse.json({ error: "No blockers were logged for that day." }, { status: 400 });

  const { data: meeting } = await db
    .from("one_on_ones")
    .select("id, agenda")
    .eq("manager_id", session.user.id)
    .eq("report_id", userId)
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!meeting) return NextResponse.json({ error: "Schedule a 1-on-1 with them first." }, { status: 400 });

  const line = `Blocker from ${date}: ${blockers}`;
  const agenda = (meeting as { agenda: string | null }).agenda ?? "";
  if (agenda.includes(line)) return NextResponse.json({ ok: true, meetingId: (meeting as { id: string }).id, added: false });
  const { error } = await db.from("one_on_ones").update({ agenda: agenda ? `${agenda}\n${line}` : line }).eq("id", (meeting as { id: string }).id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, meetingId: (meeting as { id: string }).id, added: true });
}
