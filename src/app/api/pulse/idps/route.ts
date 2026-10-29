import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user_id, title, goals, start_date, due_date } = await req.json();
  if (!user_id || !title?.trim())
    return NextResponse.json(
      { error: "A plan needs a person and a title." },
      { status: 400 },
    );
  const isSelf = user_id === session.user.id;
  if (!isSelf && !can(session.user.role, "manage_idps"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  for (const value of [start_date, due_date]) {
    if (value && !DATE.test(value))
      return NextResponse.json(
        { error: "Dates must be valid." },
        { status: 400 },
      );
  }
  if (start_date && due_date && due_date < start_date) {
    return NextResponse.json(
      { error: "The target date must be on or after the start date." },
      { status: 400 },
    );
  }

  const { data: owner } = await supabaseAdmin
    .from("users")
    .select("manager_id")
    .eq("id", user_id)
    .maybeSingle();
  const manager_id =
    (owner as { manager_id: string | null } | null)?.manager_id ?? null;

  const { data, error } = await supabaseAdmin
    .from("idps")
    .insert({
      user_id,
      manager_id,
      title: title.trim(),
      goals: goals?.trim() || null,
      start_date: start_date || null,
      due_date: due_date || null,
    })
    .select("id")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateTables("idps");
  return NextResponse.json({ id: (data as unknown as { id: string }).id });
}
