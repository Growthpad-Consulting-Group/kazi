import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

const STATUSES = ["draft", "upcoming", "live", "paused", "completed", "archived"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_recognition_campaigns")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => null) as { status?: string } | null;
  if (!body?.status || !STATUSES.includes(body.status as typeof STATUSES[number])) return NextResponse.json({ error: "Choose a valid campaign state." }, { status: 400 });
  const { error } = await supabaseAdmin.from("recognition_campaigns").update({ status: body.status as typeof STATUSES[number] }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
