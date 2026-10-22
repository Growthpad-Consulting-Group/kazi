import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateOneOnOneParticipants } from "@/lib/cache/invalidate";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_checkins")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { managerId, reportId, scheduledAt } = await req.json();
  if (!managerId || !reportId) {
    return NextResponse.json({ error: "managerId and reportId required" }, { status: 400 });
  }

  // Carry open action items from the most recent 1-on-1 between these two
  const { data: prev } = await supabaseAdmin
    .from("one_on_ones")
    .select("action_items")
    .eq("manager_id", managerId)
    .eq("report_id", reportId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  type ActionItem = { text: string; done: boolean; carried_from?: string };
  const prevItems = (prev as unknown as { action_items: ActionItem[] } | null)?.action_items ?? [];
  const carried: ActionItem[] = prevItems
    .filter((a) => !a.done)
    .map((a) => ({ text: a.text, done: false, carried_from: "previous session" }));

  const { data, error } = await supabaseAdmin
    .from("one_on_ones")
    .insert({
      manager_id: managerId,
      report_id: reportId,
      scheduled_at: scheduledAt ?? null,
      action_items: carried,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateOneOnOneParticipants({ managerId, reportId });
  return NextResponse.json({ id: (data as unknown as { id: string }).id, carried: carried.length });
}
