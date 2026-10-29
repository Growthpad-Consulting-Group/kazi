import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "manage_system")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete all rows — only ever one per org
  const { error } = await supabaseAdmin
    .from("slack_connections")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
