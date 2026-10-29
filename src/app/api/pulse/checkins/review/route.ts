import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateUserCheckins } from "@/lib/cache/invalidate";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_checkins")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { checkinId, comment } = await req.json();
  if (!checkinId)
    return NextResponse.json({ error: "checkinId required" }, { status: 400 });

  // Read the owner before the write so their cached check-ins are dropped.
  const { data: existing } = await supabaseAdmin
    .from("checkins")
    .select("user_id")
    .eq("id", checkinId)
    .maybeSingle();
  const ownerId =
    (existing as unknown as { user_id: string | null } | null)?.user_id ?? "";

  const { error } = await supabaseAdmin
    .from("checkins")
    .update({
      manager_comment: comment ?? null,
      reviewed_by: session.user.id,
      reviewed_at: new Date().toISOString(),
      status: "reviewed",
    })
    .eq("id", checkinId);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateUserCheckins(ownerId);
  return NextResponse.json({ ok: true });
}
