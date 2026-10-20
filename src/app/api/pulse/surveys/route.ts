import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "hr")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title, description, anonymous, questions, created_by } = await req.json();
  if (!title || !questions?.length) {
    return NextResponse.json({ error: "title and questions required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("surveys")
    .insert({ title, description: description ?? null, anonymous: anonymous ?? true, questions, created_by })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateTables("surveys");
  return NextResponse.json({ id: (data as unknown as { id: string }).id });
}
