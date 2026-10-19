import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import type { GoalStatus } from "@/types/database";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, progress, status } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const update: { progress?: number; status?: GoalStatus } = {};
  if (progress !== undefined) update.progress = Math.max(0, Math.min(100, progress));
  if (status) update.status = status as GoalStatus;

  const { error } = await supabaseAdmin.from("goals").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
