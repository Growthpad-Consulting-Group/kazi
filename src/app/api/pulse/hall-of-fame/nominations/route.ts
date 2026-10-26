import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { broadcastHallOfFameChange } from "@/lib/hall-of-fame-realtime";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as { cycleId?: string; nomineeId?: string; impactStatement?: string; category?: string } | null;
  const category = body?.category === "mvp" ? "mvp" : body?.category === "wow" ? "wow" : null;
  if (!category) return NextResponse.json({ error: "Choose the WOW Award or MVP of the month." }, { status: 400 });
  const impactStatement = body?.impactStatement?.trim() ?? "";
  if (!body?.cycleId || !body.nomineeId || impactStatement.length < 20 || impactStatement.length > 1200) {
    return NextResponse.json({ error: "Choose a colleague and add an impact statement between 20 and 1,200 characters." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table; generated database types lag migrations
  const db = supabaseAdmin as any;
  const { data: cycle } = await db.from("hall_of_fame_cycles").select("id, status, opens_at, closes_at").eq("id", body.cycleId).maybeSingle();
  const today = new Date().toISOString().slice(0, 10);
  if (!cycle || cycle.status !== "open" || (cycle.opens_at && cycle.opens_at > today) || (cycle.closes_at && cycle.closes_at < today)) {
    return NextResponse.json({ error: "Nominations are not open for this award cycle." }, { status: 409 });
  }
  const { data: nominee } = await supabaseAdmin.from("users").select("id, role").eq("id", body.nomineeId).eq("is_active", true).maybeSingle();
  if (!nominee || ["admin", "hr", "manager"].includes(nominee.role)) return NextResponse.json({ error: "That staff member is unavailable." }, { status: 400 });

  const { error } = await db.from("hall_of_fame_nominations").insert({ cycle_id: cycle.id, nominator_id: session.user.id, nominee_id: nominee.id, category, impact_statement: impactStatement });
  if (error?.code === "23505") return NextResponse.json({ error: "You have already nominated this colleague for this award, or already nominated yourself this cycle." }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await broadcastHallOfFameChange(cycle.id).catch(() => {});
  return NextResponse.json({ ok: true });
}
