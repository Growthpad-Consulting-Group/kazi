import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import type { IdpStatus } from "@/types/database";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  type IdpUpdate = {
    title?: string;
    goals?: string | null;
    actions?: { text: string; due_date: string | null; done: boolean }[];
    status?: IdpStatus;
    due_date?: string | null;
  };

  const update: IdpUpdate = {};
  if (body.title !== undefined) update.title = body.title;
  if (body.goals !== undefined) update.goals = body.goals;
  if (body.actions !== undefined) update.actions = body.actions;
  if (body.status !== undefined) update.status = body.status as IdpStatus;
  if (body.due_date !== undefined) update.due_date = body.due_date;

  const { error } = await supabaseAdmin.from("idps").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
