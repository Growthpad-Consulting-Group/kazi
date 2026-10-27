import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can, userCan } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { broadcastHallOfFameChange } from "@/lib/hall-of-fame-realtime";

function validDate(value: unknown): value is string { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value); }

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !userCan(session.user, "manage_recognition_campaigns")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null) as { month?: string; opensAt?: string | null; closesAt?: string | null } | null;
  if (!validDate(body?.month) || (body?.opensAt && !validDate(body.opensAt)) || (body?.closesAt && !validDate(body.closesAt)) || (body?.opensAt && body?.closesAt && body.closesAt < body.opensAt)) return NextResponse.json({ error: "Choose a valid nomination period." }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table; generated database types lag migrations
  const db = supabaseAdmin as any;
  const { data, error } = await db.from("hall_of_fame_cycles").insert({ month: `${body.month.slice(0, 7)}-01`, opens_at: body.opensAt ?? null, closes_at: body.closesAt ?? null, status: "open", created_by: session.user.id }).select("id").single();
  if (error?.code === "23505") return NextResponse.json({ error: "A Hall of Fame cycle already exists for this month." }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await broadcastHallOfFameChange(data.id).catch(() => {});
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !userCan(session.user, "manage_recognition_campaigns")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null) as { id?: string; status?: "open" | "closed" } | null;
  if (!body?.id || !["open", "closed"].includes(body.status ?? "")) return NextResponse.json({ error: "A cycle and status are required." }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table; generated database types lag migrations
  const db = supabaseAdmin as any;
  const { error } = await db.from("hall_of_fame_cycles").update({ status: body.status }).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await broadcastHallOfFameChange(body.id).catch(() => {});
  return NextResponse.json({ ok: true });
}
