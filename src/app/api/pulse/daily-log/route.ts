import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { awardDailyLogRewards } from "@/features/pulse/daily-log/rewards";
import { supabaseAdmin } from "@/lib/supabase";
import {
  cleanText,
  clockToMinutes,
  isEditableLogDate,
  isValidLogDate,
  validateDailyLogEntries,
  validateDailyLogMood,
  type DailyLogEntry,
} from "@/features/pulse/daily-log/constants";

type LogRow = {
  user_id: string;
  log_date: string;
  entries: DailyLogEntry[];
  updated_at: string;
  mood: number | null;
  blockers: string | null;
  wins: string | null;
  acknowledged_at: string | null;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- daily_log_comments and acknowledged_at are newer than the generated types
const db = supabaseAdmin as any;
type TeamLogRow = LogRow;

const MAX_RANGE_DAYS = 93;
const DEFAULT_WORKDAY_START = 8 * 60;
const DEFAULT_WORKDAY_END = 17 * 60;

function outsideWorkMinutes(entry: DailyLogEntry) {
  if (!entry.startTime || !entry.endTime) return 0;
  const start = clockToMinutes(entry.startTime);
  const end = clockToMinutes(entry.endTime);
  return (
    Math.max(0, DEFAULT_WORKDAY_START - start) +
    Math.max(0, end - DEFAULT_WORKDAY_END)
  );
}

function daysBetween(from: string, to: string) {
  return (
    Math.round(
      (new Date(`${to}T00:00:00Z`).getTime() -
        new Date(`${from}T00:00:00Z`).getTime()) /
        86_400_000,
    ) + 1
  );
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);

  if (url.searchParams.get("scope") === "history") {
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!isValidLogDate(from) || !isValidLogDate(to) || from > to)
      return NextResponse.json(
        { error: "A valid from and to date are required" },
        { status: 400 },
      );
    const { data } = await supabaseAdmin
      .from("daily_activity_logs")
      .select("log_date, entries, mood, blockers, wins, updated_at")
      .eq("user_id", session.user.id)
      .gte("log_date", from)
      .lte("log_date", to)
      .order("log_date", { ascending: false });
    return NextResponse.json({
      logs: (
        (data ?? []) as unknown as {
          log_date: string;
          entries: DailyLogEntry[];
          mood: number | null;
          blockers: string | null;
          wins: string | null;
          updated_at: string;
        }[]
      ).map((row) => ({
        date: row.log_date,
        entries: row.entries,
        mood: row.mood,
        blockers: row.blockers,
        wins: row.wins,
        updatedAt: row.updated_at,
      })),
    });
  }

  if (url.searchParams.get("scope") !== "team") {
    const date = url.searchParams.get("date");
    if (!isValidLogDate(date))
      return NextResponse.json(
        { error: "A valid date is required" },
        { status: 400 },
      );
    const { data } = await supabaseAdmin
      .from("daily_activity_logs")
      .select("entries, created_at, updated_at, mood, blockers, wins")
      .eq("user_id", session.user.id)
      .eq("log_date", date)
      .maybeSingle();
    const row = data as unknown as {
      entries: DailyLogEntry[];
      created_at: string;
      updated_at: string;
      mood: number | null;
      blockers: string | null;
      wins: string | null;
    } | null;
    return NextResponse.json({
      entries: row?.entries ?? [],
      updatedAt: row?.updated_at ?? null,
      edited: row
        ? new Date(row.updated_at).getTime() -
            new Date(row.created_at).getTime() >
          60_000
        : false,
      mood: row?.mood ?? null,
      blockers: row?.blockers ?? null,
      wins: row?.wins ?? null,
    });
  }

  if (!can(session.user.role, "manage_checkins")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!isValidLogDate(from) || !isValidLogDate(to) || from > to) {
    return NextResponse.json(
      { error: "A valid from and to date are required" },
      { status: 400 },
    );
  }
  if (daysBetween(from, to) > MAX_RANGE_DAYS) {
    return NextResponse.json(
      { error: `Choose a range of ${MAX_RANGE_DAYS} days or fewer` },
      { status: 400 },
    );
  }

  let teamQuery = supabaseAdmin
    .from("users")
    .select("id, name, job_title, avatar_url")
    .eq("is_active", true)
    .order("name");
  if (session.user.role === "manager")
    teamQuery = teamQuery.eq("manager_id", session.user.id);
  const { data: members } = await teamQuery;
  const team = (members ?? []) as unknown as {
    id: string;
    name: string;
    job_title: string | null;
    avatar_url: string | null;
  }[];
  if (!team.length) return NextResponse.json({ team: [] });

  const memberIds = team.map((member) => member.id);
  const { data: signatureProfiles } = await (supabaseAdmin as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("signature_staff_profiles")
    .select("user_id, photo_url")
    .in("user_id", memberIds);
  const signaturePhotoByUser = new Map(
    (
      (signatureProfiles ?? []) as {
        user_id: string | null;
        photo_url: string | null;
      }[]
    )
      .filter((profile) => profile.user_id && profile.photo_url)
      .map((profile) => [profile.user_id!, profile.photo_url!]),
  );

  const { data: logs } = await supabaseAdmin
    .from("daily_activity_logs")
    .select(
      "user_id, log_date, entries, updated_at, mood, blockers, wins, acknowledged_at",
    )
    .gte("log_date", from)
    .lte("log_date", to)
    .in("user_id", memberIds);
  const logsByUser = new Map<string, TeamLogRow[]>();
  for (const log of (logs ?? []) as unknown as TeamLogRow[]) {
    logsByUser.set(log.user_id, [...(logsByUser.get(log.user_id) ?? []), log]);
  }

  // Points each person earned in this range, from the reward ledger.
  const { data: ledgerRows } = await db
    .from("reward_ledger")
    .select("user_id, amount")
    .in("user_id", memberIds)
    .gt("amount", 0)
    .gte("created_at", `${from}T00:00:00Z`)
    .lt("created_at", `${to}T23:59:59Z`);
  const pointsByUser = new Map<string, number>();
  for (const row of (ledgerRows ?? []) as {
    user_id: string;
    amount: number;
  }[]) {
    pointsByUser.set(
      row.user_id,
      (pointsByUser.get(row.user_id) ?? 0) + row.amount,
    );
  }

  const { data: commentRows } = await db
    .from("daily_log_comments")
    .select("id, user_id, log_date, body, author_id, created_at")
    .gte("log_date", from)
    .lte("log_date", to)
    .in("user_id", memberIds)
    .order("created_at", { ascending: true });
  const commentRowList = (commentRows ?? []) as {
    id: string;
    user_id: string;
    log_date: string;
    body: string;
    author_id: string | null;
    created_at: string;
  }[];
  const authorIds = [
    ...new Set(
      commentRowList
        .map((row) => row.author_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const { data: authors } = authorIds.length
    ? await db.from("users").select("id, name").in("id", authorIds)
    : { data: [] };
  const authorNames = new Map(
    ((authors ?? []) as { id: string; name: string }[]).map((author) => [
      author.id,
      author.name,
    ]),
  );
  const commentsByUser = new Map<
    string,
    {
      id: string;
      date: string;
      body: string;
      authorName: string | null;
      createdAt: string;
    }[]
  >();
  for (const row of commentRowList) {
    commentsByUser.set(row.user_id, [
      ...(commentsByUser.get(row.user_id) ?? []),
      {
        id: row.id,
        date: row.log_date,
        body: row.body,
        authorName: row.author_id
          ? (authorNames.get(row.author_id) ?? null)
          : null,
        createdAt: row.created_at,
      },
    ]);
  }

  return NextResponse.json({
    range: { from, to },
    team: team.map((member) => {
      const memberLogs = (logsByUser.get(member.id) ?? []).sort((a, b) =>
        b.log_date.localeCompare(a.log_date),
      );
      const entries = memberLogs.flatMap((log) =>
        log.entries.map((entry) => ({ ...entry, date: log.log_date })),
      );
      const byCategory: Record<string, number> = {};
      for (const entry of entries)
        byCategory[entry.category] =
          (byCategory[entry.category] ?? 0) + entry.minutes;
      return {
        userId: member.id,
        name: member.name,
        jobTitle: member.job_title,
        avatarUrl:
          member.avatar_url ?? signaturePhotoByUser.get(member.id) ?? null,
        days: memberLogs.map((log) => ({
          date: log.log_date,
          mood: log.mood ?? null,
          blockers: log.blockers ?? null,
          wins: log.wins ?? null,
          hasEntries: log.entries.length > 0,
          acknowledged: Boolean(log.acknowledged_at),
        })),
        comments: commentsByUser.get(member.id) ?? [],
        pointsEarned: pointsByUser.get(member.id) ?? 0,
        daysLogged: memberLogs.filter((log) => log.entries.length > 0).length,
        totalMinutes: entries.reduce((sum, entry) => sum + entry.minutes, 0),
        byCategory,
        entries,
      };
    }),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (can(session.user.role, "manage_checkins")) {
    return NextResponse.json(
      {
        error:
          "Managers, HR and admins review logs and don't submit their own.",
      },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    date?: unknown;
    entries?: unknown;
    mood?: unknown;
    blockers?: unknown;
    wins?: unknown;
  } | null;
  if (!isValidLogDate(body?.date))
    return NextResponse.json(
      { error: "A valid date is required" },
      { status: 400 },
    );
  if (!isEditableLogDate(body.date))
    return NextResponse.json(
      {
        error:
          "This day is locked. Logs can be added or corrected for the last 7 days.",
      },
      { status: 403 },
    );

  const validated = validateDailyLogEntries(body?.entries);
  if (!validated.ok)
    return NextResponse.json({ error: validated.error }, { status: 400 });
  const mood = validateDailyLogMood(body?.mood);
  if (!mood.ok)
    return NextResponse.json({ error: mood.error }, { status: 400 });
  const outsideEntries = validated.entries
    .map((entry, index) => ({
      entry,
      index,
      minutes: outsideWorkMinutes(entry),
    }))
    .filter((item) => item.entry.claimOutsideHours);
  if (outsideEntries.some(({ minutes }) => minutes === 0)) {
    return NextResponse.json(
      {
        error:
          "Only time outside 08:00–17:00 Nairobi time can be sent for outside-hours review.",
      },
      { status: 400 },
    );
  }
  if (outsideEntries.some(({ entry }) => !entry.outsideHoursReason)) {
    return NextResponse.json(
      {
        error:
          "Add a short reason for each time-range entry outside 08:00–17:00 Nairobi time.",
      },
      { status: 400 },
    );
  }

  const { error } = await (supabaseAdmin as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("daily_activity_logs")
    .upsert(
      {
        user_id: session.user.id,
        log_date: body.date,
        entries: validated.entries,
        mood: mood.mood,
        blockers: cleanText(body.blockers),
        wins: cleanText(body.wins),
      },
      { onConflict: "user_id,log_date" },
    );
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  if (outsideEntries.length) {
    const { data: staff } = await supabaseAdmin
      .from("users")
      .select("manager_id")
      .eq("id", session.user.id)
      .maybeSingle();
    const requests = outsideEntries.map(({ entry, index, minutes }) => ({
      user_id: session.user.id,
      log_date: body.date,
      entry_key: `${index}:${entry.startTime}-${entry.endTime}`,
      task: entry.task,
      start_time: entry.startTime,
      end_time: entry.endTime,
      outside_minutes: minutes,
      reason: entry.outsideHoursReason!,
    }));
    const { error: overtimeError } = await db
      .from("overtime_requests")
      .upsert(requests, { onConflict: "user_id,log_date,entry_key" });
    if (overtimeError)
      return NextResponse.json(
        { error: overtimeError.message },
        { status: 500 },
      );
    if (staff?.manager_id) {
      await supabaseAdmin.from("notifications").insert({
        user_id: staff.manager_id,
        message: `Outside-hours work submitted for review on ${body.date}.`,
        link: "/pulse/checkins?tab=daily",
      });
    }
  }

  // A saved log can earn points. A failure here must not undo the save.
  try {
    await awardDailyLogRewards(session.user.id, body.date, validated.entries);
  } catch (rewardError) {
    console.error("Daily log rewards failed", rewardError);
  }

  return NextResponse.json({ ok: true });
}
