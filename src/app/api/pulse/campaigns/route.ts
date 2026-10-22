import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

const AUDIENCES = ["company", "department", "location", "manager_group", "staff"] as const;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_recognition_campaigns")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { name?: string; goal?: string; audience_type?: string; starts_at?: string; ends_at?: string; value_ids?: string[] } | null;
  if (!body?.name?.trim() || !body.audience_type || !AUDIENCES.includes(body.audience_type as typeof AUDIENCES[number])) return NextResponse.json({ error: "Name and audience are required." }, { status: 400 });
  const initialStatus = body.starts_at && new Date(body.starts_at) > new Date() ? "upcoming" : "draft";
  const { data, error } = await supabaseAdmin.from("recognition_campaigns").insert({ name: body.name.trim(), goal: body.goal?.trim() || null, audience_type: body.audience_type as typeof AUDIENCES[number], starts_at: body.starts_at || null, ends_at: body.ends_at || null, value_ids: body.value_ids ?? [], status: initialStatus, created_by: session.user.id }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
