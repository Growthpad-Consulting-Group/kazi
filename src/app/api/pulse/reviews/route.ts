import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import type { ReviewCycle } from "@/types/database";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "hr")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title, cycle, start_date, end_date, created_by } = await req.json();
  if (!title || !cycle || !start_date || !end_date) {
    return NextResponse.json({ error: "title, cycle, start_date, end_date required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("review_cycles")
    .insert({ title, cycle: cycle as ReviewCycle, start_date, end_date, created_by })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: (data as unknown as { id: string }).id });
}
