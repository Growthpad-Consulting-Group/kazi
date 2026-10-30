import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { userCan } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { broadcastHallOfFameChange } from "@/lib/hall-of-fame-realtime";

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !userCan(session.user, "manage_recognition_campaigns"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as {
    month?: string;
    opensAt?: string | null;
    closesAt?: string | null;
  } | null;
  if (
    !validDate(body?.month) ||
    (body?.opensAt && !validDate(body.opensAt)) ||
    (body?.closesAt && !validDate(body.closesAt)) ||
    (body?.opensAt && body?.closesAt && body.closesAt < body.opensAt)
  )
    return NextResponse.json(
      { error: "Choose a valid nomination period." },
      { status: 400 },
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table; generated database types lag migrations
  const db = supabaseAdmin as any;
  const { data, error } = await db
    .from("hall_of_fame_cycles")
    .insert({
      month: `${body.month.slice(0, 7)}-01`,
      opens_at: body.opensAt ?? null,
      closes_at: body.closesAt ?? null,
      status: "open",
      created_by: session.user.id,
    })
    .select("id")
    .single();
  if (error?.code === "23505")
    return NextResponse.json(
      { error: "A Wall of Fame cycle already exists for this month." },
      { status: 409 },
    );
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  await broadcastHallOfFameChange(data.id).catch(() => {});
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !userCan(session.user, "manage_recognition_campaigns"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as {
    id?: string;
    status?:
      "open" | "team_voting" | "management_voting" | "published" | "closed";
  } | null;
  if (
    !body?.id ||
    ![
      "open",
      "team_voting",
      "management_voting",
      "published",
      "closed",
    ].includes(body.status ?? "")
  )
    return NextResponse.json(
      { error: "A cycle and status are required." },
      { status: 400 },
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table; generated database types lag migrations
  const db = supabaseAdmin as any;
  if (body.status === "team_voting") {
    const [
      { data: eligibleStaff, error: staffError },
      { data: entries, error: entriesError },
    ] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select("id")
        .eq("is_active", true)
        .not("role", "in", "(admin,hr,manager)"),
      db
        .from("hall_of_fame_nominations")
        .select("nominator_id, nominee_id")
        .eq("cycle_id", body.id),
    ]);
    if (staffError || entriesError)
      return NextResponse.json(
        { error: staffError?.message ?? entriesError?.message },
        { status: 500 },
      );
    const entered = new Set(
      (entries ?? [])
        .filter(
          (entry: { nominator_id: string; nominee_id: string }) =>
            entry.nominator_id === entry.nominee_id,
        )
        .map((entry: { nominator_id: string }) => entry.nominator_id),
    );
    const missing = (eligibleStaff ?? []).filter(
      (member) => !entered.has(member.id),
    );
    if (missing.length > 0)
      return NextResponse.json(
        {
          error: `${missing.length} eligible staff member${missing.length === 1 ? " has" : "s have"} not submitted a monthly project entry yet.`,
          missingEntries: missing.length,
        },
        { status: 409 },
      );
  }
  const { error } = await db
    .from("hall_of_fame_cycles")
    .update({ status: body.status })
    .eq("id", body.id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  await broadcastHallOfFameChange(body.id).catch(() => {});
  return NextResponse.json({ ok: true });
}
