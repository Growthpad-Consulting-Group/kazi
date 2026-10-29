import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { isValidLogDate } from "@/features/pulse/daily-log/constants";
import { canActOnDailyLog } from "@/features/pulse/daily-log/access";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- daily_log_comments is newer than the generated types
const db = supabaseAdmin as any;
const MAX_BODY_LENGTH = 1000;

export type DailyLogComment = {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: string;
};

/** Notes a manager leaves on an employee's day. The employee can read them; only the manager can write them. */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? session.user.id;
  const date = url.searchParams.get("date");
  if (!isValidLogDate(date))
    return NextResponse.json(
      { error: "A valid date is required" },
      { status: 400 },
    );
  if (
    userId !== session.user.id &&
    !(await canActOnDailyLog(session, userId))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await db
    .from("daily_log_comments")
    .select("id, body, author_id, created_at")
    .eq("user_id", userId)
    .eq("log_date", date)
    .order("created_at", { ascending: true });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as {
    id: string;
    body: string;
    author_id: string | null;
    created_at: string;
  }[];
  const authorIds = [
    ...new Set(
      rows
        .map((row) => row.author_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const { data: authors } = authorIds.length
    ? await db.from("users").select("id, name").in("id", authorIds)
    : { data: [] };
  const names = new Map(
    ((authors ?? []) as { id: string; name: string }[]).map((author) => [
      author.id,
      author.name,
    ]),
  );

  const comments: DailyLogComment[] = rows.map((row) => ({
    id: row.id,
    body: row.body,
    authorName: row.author_id ? (names.get(row.author_id) ?? null) : null,
    createdAt: row.created_at,
  }));
  return NextResponse.json({ comments });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    userId?: string;
    date?: string;
    body?: string;
  } | null;
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (
    typeof body?.userId !== "string" ||
    !isValidLogDate(body?.date) ||
    !text
  ) {
    return NextResponse.json(
      { error: "Write a note for a person and a date" },
      { status: 400 },
    );
  }
  if (text.length > MAX_BODY_LENGTH)
    return NextResponse.json(
      { error: `Keep the note under ${MAX_BODY_LENGTH} characters` },
      { status: 400 },
    );
  const { userId, date } = { userId: body.userId, date: body.date };
  if (!(await canActOnDailyLog(session, userId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await db
    .from("daily_log_comments")
    .insert({
      user_id: userId,
      log_date: date,
      author_id: session.user.id,
      body: text,
    })
    .select("id, body, created_at")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("notifications").insert({
    user_id: userId,
    message: `${session.user.name} left a note on your ${date} log.`,
    link: "/pulse/checkins?tab=daily",
  });

  const row = data as { id: string; body: string; created_at: string };
  const comment: DailyLogComment = {
    id: row.id,
    body: row.body,
    authorName: session.user.name ?? null,
    createdAt: row.created_at,
  };
  return NextResponse.json({ comment });
}
