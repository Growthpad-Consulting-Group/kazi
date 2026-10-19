import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { agenda, notes, action_items } = await req.json();

  type OooUpdate = {
    agenda?: string | null;
    notes?: string | null;
    action_items?: { text: string; done: boolean; carried_from?: string }[];
  };
  const update: OooUpdate = {};
  if (agenda !== undefined) update.agenda = agenda;
  if (notes !== undefined) update.notes = notes;
  if (action_items !== undefined) update.action_items = action_items;

  const { error } = await supabaseAdmin.from("one_on_ones").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
