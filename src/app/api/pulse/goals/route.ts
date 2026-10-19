import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import type { GoalLevel } from "@/types/database";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title, description, level, owner_id, parent_id, due_date, created_by } = await req.json();
  if (!title || !level) return NextResponse.json({ error: "title and level required" }, { status: 400 });

  const { error } = await supabaseAdmin.from("goals").insert({
    title,
    description: description ?? null,
    level: level as GoalLevel,
    owner_id: owner_id ?? null,
    parent_id: parent_id ?? null,
    due_date: due_date ?? null,
    created_by,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
