import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { deliverSlackNotification } from "@/lib/slack";

// Coffee chats are intentionally simple: opt in is personal, while a manager
// generates a month's private matches. No calendar event or staff data is shared.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables
const db = supabaseAdmin as any;
const periodStart = () => new Date().toISOString().slice(0, 7) + "-01";
const calendarLink =
  "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Growthpad%20coffee%20chat";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const period = periodStart();
  const [{ data: preference }, { data: matches }, { data: settings }] =
    await Promise.all([
      db
        .from("coffee_chat_preferences")
        .select("opted_in")
        .eq("user_id", session.user.id)
        .maybeSingle(),
      db
        .from("coffee_chat_matches")
        .select("*, a:user_a_id(name), b:user_b_id(name)")
        .eq("period_start", period)
        .or(`user_a_id.eq.${session.user.id},user_b_id.eq.${session.user.id}`),
      db
        .from("company_settings")
        .select("coffee_chat_repeat_months")
        .eq("id", "default")
        .maybeSingle(),
    ]);
  return NextResponse.json({
    optedIn: Boolean(preference?.opted_in),
    matches: matches ?? [],
    canGenerate: can(session.user.role, "manage_system"),
    currentUserId: session.user.id,
    calendarLink,
    repeatMonths: settings?.coffee_chat_repeat_months ?? 3,
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    optedIn?: boolean;
    matchId?: string;
    action?: "accept" | "skip" | "rematch";
  } | null;
  if (typeof body?.optedIn === "boolean") {
    const { error } = await db.from("coffee_chat_preferences").upsert(
      {
        user_id: session.user.id,
        opted_in: body.optedIn,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (!body?.matchId || !body.action)
    return NextResponse.json({ error: "Choose an action." }, { status: 400 });
  const { data: match } = await db
    .from("coffee_chat_matches")
    .select("user_a_id,user_b_id")
    .eq("id", body.matchId)
    .maybeSingle();
  if (!match || ![match.user_a_id, match.user_b_id].includes(session.user.id))
    return NextResponse.json({ error: "Match unavailable." }, { status: 404 });
  const status =
    body.action === "accept"
      ? "accepted"
      : body.action === "rematch"
        ? "rematch_requested"
        : "skipped";
  await db
    .from("coffee_chat_matches")
    .update({ status })
    .eq("id", body.matchId);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const cronAuthorised = Boolean(
    process.env.CRON_SECRET &&
    request.headers.get("authorization") ===
      `Bearer ${process.env.CRON_SECRET}`,
  );
  if ((!session || !can(session.user.role, "manage_system")) && !cronAuthorised)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const period = periodStart();
  const [{ data: prefs }, { data: settings }, { data: previous }] =
    await Promise.all([
      db.from("coffee_chat_preferences").select("user_id").eq("opted_in", true),
      db
        .from("company_settings")
        .select("coffee_chat_repeat_months")
        .eq("id", "default")
        .maybeSingle(),
      db.from("coffee_chat_matches").select("user_a_id,user_b_id,created_at"),
    ]);
  const optedInIds = (prefs ?? []).map(
    (row: { user_id: string }) => row.user_id,
  );
  const { data: people } = await supabaseAdmin
    .from("users")
    .select("id,name,manager_id")
    .in("id", optedInIds)
    .eq("is_active", true)
    .order("name");
  const months = Math.max(
    1,
    Math.min(12, settings?.coffee_chat_repeat_months ?? 3),
  );
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const recent = new Set(
    (previous ?? [])
      .filter((m: { created_at: string }) => new Date(m.created_at) >= cutoff)
      .map((m: { user_a_id: string; user_b_id: string }) =>
        [m.user_a_id, m.user_b_id].sort().join(":"),
      ),
  );
  const pool = [...(people ?? [])].sort(() => Math.random() - 0.5);
  const pairs: { user_a_id: string; user_b_id: string }[] = [];
  while (pool.length > 1) {
    const first = pool.shift()!;
    const index = pool.findIndex(
      (candidate) =>
        candidate.manager_id !== first.id &&
        first.manager_id !== candidate.id &&
        !recent.has([first.id, candidate.id].sort().join(":")),
    );
    if (index < 0) continue;
    const second = pool.splice(index, 1)[0];
    pairs.push({ user_a_id: first.id, user_b_id: second.id });
  }
  if (!pairs.length)
    return NextResponse.json({
      created: 0,
      message: "No new eligible pairs this month.",
    });
  const { data: created, error } = await db
    .from("coffee_chat_matches")
    .upsert(
      pairs.map((pair) => ({ ...pair, period_start: period })),
      { onConflict: "period_start,user_a_id,user_b_id" },
    )
    .select("id,user_a_id,user_b_id");
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  const names = new Map(
    (people ?? []).map((person) => [person.id, person.name]),
  );
  const appUrl = process.env.PRODUCTION_APP_URL ?? "http://localhost:3000";
  await Promise.all(
    (created ?? []).flatMap(
      (match: { id: string; user_a_id: string; user_b_id: string }) =>
        [match.user_a_id, match.user_b_id].map((userId) => {
          const partnerId =
            userId === match.user_a_id ? match.user_b_id : match.user_a_id;
          return deliverSlackNotification({
            eventKey: `coffee-chat:${match.id}:${userId}`,
            recipientUserId: userId,
            category: "campaign_update",
            text: `Your Growthpad coffee chat match is ${names.get(partnerId)}. <${calendarLink}|Find a time> or <${appUrl}/pulse/coffee-chats|manage this match>.`,
            digest: true,
          });
        }),
    ),
  );
  return NextResponse.json({ created: created?.length ?? 0 });
}
