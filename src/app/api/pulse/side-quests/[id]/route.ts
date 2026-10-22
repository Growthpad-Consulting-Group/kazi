import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

const STATUSES = ["draft", "upcoming", "live", "closed", "archived"] as const;
type SideQuestStatus = typeof STATUSES[number];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_side_quests")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null) as { status?: string } | null;
  if (!body?.status || !STATUSES.includes(body.status as SideQuestStatus)) {
    return NextResponse.json({ error: "Choose a valid side quest state." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("side_quests")
    .update({ status: body.status as SideQuestStatus })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
