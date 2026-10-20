import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user_id, manager_id, title, goals, due_date } = await req.json();
  if (!user_id || !title) return NextResponse.json({ error: "user_id and title required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("idps")
    .insert({ user_id, manager_id: manager_id ?? null, title, goals: goals ?? null, due_date: due_date ?? null })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateTables("idps");
  return NextResponse.json({ id: (data as unknown as { id: string }).id });
}
