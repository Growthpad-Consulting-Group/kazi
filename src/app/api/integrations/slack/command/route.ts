import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveSlackLink } from "@/lib/slack-links";
import { verifySlackSignature } from "@/lib/slack-signature";
import { localClock, weekStartOf } from "@/lib/slack-schedule";

const TIMEZONE = "Africa/Nairobi";

function appUrl() {
  return process.env.PRODUCTION_APP_URL ?? "http://localhost:3000";
}

function reply(text: string) {
  // Ephemeral: only the person who typed the command sees it.
  return NextResponse.json({ response_type: "ephemeral", text });
}

// Every answer is about the invoking person's own record. Nothing is shared with the channel.
async function answer(userId: string, command: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables
  const db = supabaseAdmin as any;
  const clock = localClock(new Date(), TIMEZONE);
  const week = weekStartOf(clock.date, clock.weekday);
  const base = appUrl();

  if (command === "today") {
    const from = new Date(Date.now() - 3_600_000).toISOString();
    const to = new Date(Date.now() + 24 * 3_600_000).toISOString();
    const [meetings, log, checkin] = await Promise.all([
      db
        .from("one_on_ones")
        .select("id")
        .or(`manager_id.eq.${userId},report_id.eq.${userId}`)
        .gte("scheduled_at", from)
        .lte("scheduled_at", to),
      db
        .from("daily_activity_logs")
        .select("entries")
        .eq("user_id", userId)
        .eq("log_date", clock.date)
        .maybeSingle(),
      db
        .from("checkins")
        .select("status")
        .eq("user_id", userId)
        .eq("week_start", week)
        .maybeSingle(),
    ]);
    const meetingCount = (meetings.data ?? []).length;
    const logged =
      Array.isArray(log.data?.entries) && log.data.entries.length > 0;
    const submitted = ["submitted", "reviewed"].includes(
      checkin.data?.status ?? "",
    );
    return [
      "*Your day in Kazi*",
      `• 1-on-1s in the next 24 hours: ${meetingCount}`,
      `• Daily log: ${logged ? "logged" : "not logged yet"}`,
      `• Weekly check-in: ${submitted ? "submitted" : "still to submit"}`,
      `<${base}/pulse|Open today in Kazi>`,
    ].join("\n");
  }

  if (command === "check-in") {
    const { data } = await db
      .from("checkins")
      .select("status")
      .eq("user_id", userId)
      .eq("week_start", week)
      .maybeSingle();
    const status = data?.status ?? "not started";
    return `This week's check-in: *${status}*.\n<${base}/pulse/checkins|Open weekly check-in>`;
  }

  if (command === "goals") {
    const dueBy = new Date(Date.now() + 7 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const { data } = await db
      .from("goals")
      .select("due_date")
      .eq("owner_id", userId)
      .not("status", "in", "(completed,cancelled)");
    const open = (data ?? []) as { due_date: string | null }[];
    const dueSoon = open.filter(
      (goal) => goal.due_date && goal.due_date <= dueBy,
    ).length;
    return `You have *${open.length}* open ${open.length === 1 ? "goal" : "goals"}${dueSoon ? `, ${dueSoon} due within a week` : ""}.\n<${base}/pulse/goals|Open goals in Kazi>`;
  }

  if (command === "timer") {
    return `Start your timer from the Kazi Timer browser extension, or log time in your daily log.\n<${base}/pulse/checkins?tab=daily|Open the daily log>`;
  }

  return [
    "Kazi commands (only you see these answers):",
    "• `/kazi today` – your day at a glance",
    "• `/kazi check-in` – this week's check-in",
    "• `/kazi goals` – your open goals",
    "• `/kazi timer` – where to track time",
  ].join("\n");
}

export async function POST(request: Request) {
  const raw = await request.text();
  const valid = verifySlackSignature({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    timestamp: request.headers.get("x-slack-request-timestamp"),
    rawBody: raw,
    signature: request.headers.get("x-slack-signature"),
  });
  if (!valid)
    return NextResponse.json(
      { error: "Invalid Slack signature" },
      { status: 401 },
    );

  const params = new URLSearchParams(raw);
  const slackUserId = params.get("user_id") ?? "";
  const command = (params.get("text") ?? "").trim().toLowerCase();

  const link = await resolveSlackLink(slackUserId);
  if (!link)
    return reply(
      "Your Slack account is not linked to Kazi yet. Ask your administrator to connect it.",
    );

  const text = await answer(link.user_id, command);
  return reply(text);
}
