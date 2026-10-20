import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateOwnerGoals } from "@/lib/cache/invalidate";
import type { GoalStatus } from "@/types/database";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, progress, status } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const update: { progress?: number; status?: GoalStatus } = {};
  if (progress !== undefined) update.progress = Math.max(0, Math.min(100, progress));
  if (status) update.status = status as GoalStatus;

  // Read the owner (and parent) before the write so the right cached lists
  // can be dropped afterwards.
  const { data: existing } = await supabaseAdmin
    .from("goals")
    .select("owner_id, parent_id")
    .eq("id", id)
    .maybeSingle();
  const before = existing as unknown as { owner_id: string | null; parent_id: string | null } | null;
  const ownerId = before?.owner_id ?? "";
  const parentId = before?.parent_id ?? null;

  const { error } = await supabaseAdmin.from("goals").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Roll up progress to parent if this goal has one
  if (parentId) {
    const { data: siblings } = await supabaseAdmin.from("goals").select("progress").eq("parent_id", parentId);
    const sibs = (siblings ?? []) as unknown as { progress: number }[];
    if (sibs.length) {
      const avg = Math.round(sibs.reduce((sum, s) => sum + s.progress, 0) / sibs.length);
      await supabaseAdmin.from("goals").update({ progress: avg }).eq("id", parentId);
    }
  }

  await invalidateOwnerGoals(ownerId);
  // The parent goal's progress changed too — its owner may differ.
  if (parentId) {
    const { data: parent } = await supabaseAdmin
      .from("goals")
      .select("owner_id")
      .eq("id", parentId)
      .maybeSingle();
    await invalidateOwnerGoals(
      (parent as unknown as { owner_id: string | null } | null)?.owner_id ?? ""
    );
  }
  return NextResponse.json({ ok: true });
}
