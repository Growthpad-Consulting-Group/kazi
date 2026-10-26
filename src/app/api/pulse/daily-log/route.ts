import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { isValidLogDate, validateDailyLogEntries, type DailyLogEntry } from "@/features/pulse/daily-log/constants";

type LogRow = { user_id: string; log_date: string; entries: DailyLogEntry[]; updated_at: string };

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!isValidLogDate(date)) return NextResponse.json({ error: "A valid date is required" }, { status: 400 });

  if (url.searchParams.get("scope") !== "team") {
    const { data } = await supabaseAdmin
      .from("daily_activity_logs")
      .select("entries, updated_at")
      .eq("user_id", session.user.id)
      .eq("log_date", date)
      .maybeSingle();
    const row = data as unknown as { entries: DailyLogEntry[]; updated_at: string } | null;
    return NextResponse.json({ entries: row?.entries ?? [], updatedAt: row?.updated_at ?? null });
  }

  if (!can(session.user.role, "manage_checkins")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let teamQuery = supabaseAdmin.from("users").select("id, name, job_title").eq("is_active", true).order("name");
  if (session.user.role === "manager") teamQuery = teamQuery.eq("manager_id", session.user.id);
  const { data: members } = await teamQuery;
  const team = (members ?? []) as unknown as { id: string; name: string; job_title: string | null }[];
  if (!team.length) return NextResponse.json({ team: [] });

  const { data: logs } = await supabaseAdmin
    .from("daily_activity_logs")
    .select("user_id, log_date, entries, updated_at")
    .eq("log_date", date)
    .in("user_id", team.map((member) => member.id));
  const byUser = new Map(((logs ?? []) as unknown as LogRow[]).map((log): [string, LogRow] => [log.user_id, log]));

  return NextResponse.json({
    team: team.map((member) => {
      const log = byUser.get(member.id);
      const entries = log?.entries ?? [];
      return {
        userId: member.id,
        name: member.name,
        jobTitle: member.job_title,
        entries,
        totalMinutes: entries.reduce((sum, entry) => sum + entry.minutes, 0),
        updatedAt: log?.updated_at ?? null,
      };
    }),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { date?: unknown; entries?: unknown } | null;
  if (!isValidLogDate(body?.date)) return NextResponse.json({ error: "A valid date is required" }, { status: 400 });

  const validated = validateDailyLogEntries(body?.entries);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  const { error } = await (supabaseAdmin as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("daily_activity_logs")
    .upsert(
      { user_id: session.user.id, log_date: body.date, entries: validated.entries },
      { onConflict: "user_id,log_date" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
