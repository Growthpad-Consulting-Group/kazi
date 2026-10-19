import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { checkinId, comment } = await req.json();
  if (!checkinId) return NextResponse.json({ error: "checkinId required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("checkins")
    .update({
      manager_comment: comment ?? null,
      reviewed_by: session.user.id,
      reviewed_at: new Date().toISOString(),
      status: "reviewed",
    })
    .eq("id", checkinId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
