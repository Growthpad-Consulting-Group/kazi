import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateUserCheckins } from "@/lib/cache/invalidate";
import type { CheckinStatus } from "@/types/database";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, weekStart, wins, priorities, blockers, mood, status } = await req.json();

  // Users can only update their own check-in (unless admin/hr)
  if (userId !== session.user.id && !["admin", "hr"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from("checkins").upsert(
    {
      user_id: userId,
      week_start: weekStart,
      wins: wins ?? null,
      priorities: priorities ?? null,
      blockers: blockers ?? null,
      mood: mood ?? null,
      status: (status ?? "draft") as CheckinStatus,
    },
    { onConflict: "user_id,week_start" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateUserCheckins(userId);
  return NextResponse.json({ ok: true });
}
