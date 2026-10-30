import { NextResponse } from "next/server";
import { hasCronAccess } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!hasCronAccess(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date().toISOString();
  const [
    { data: opened, error: openError },
    { data: closed, error: closeError },
  ] = await Promise.all([
    supabaseAdmin
      .from("side_quests")
      .update({ status: "live" })
      .eq("status", "upcoming")
      .lte("starts_at", now)
      .select("id"),
    supabaseAdmin
      .from("side_quests")
      .update({ status: "closed" })
      .eq("status", "live")
      .lt("ends_at", now)
      .select("id"),
  ]);
  if (openError || closeError)
    return NextResponse.json(
      { error: openError?.message ?? closeError?.message },
      { status: 500 },
    );
  return NextResponse.json({
    opened: opened?.length ?? 0,
    closed: closed?.length ?? 0,
  });
}
