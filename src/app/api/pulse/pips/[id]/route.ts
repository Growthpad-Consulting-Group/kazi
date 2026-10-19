import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import type { Pip } from "@/types/database";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing } = await supabaseAdmin.from("pips").select("*").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pip = existing as unknown as Pip;
  if (pip.user_id !== session.user.id && pip.manager_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const allowed: Partial<Pip> = {};

  if (body.actions !== undefined) allowed.actions = body.actions;
  if (body.resolved_at !== undefined && pip.manager_id === session.user.id) {
    allowed.resolved_at = body.resolved_at;
  }

  const { data, error } = await supabaseAdmin
    .from("pips")
    .update(allowed)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
