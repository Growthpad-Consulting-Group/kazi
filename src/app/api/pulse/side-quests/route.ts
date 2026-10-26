import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

const audiences = new Set(["company", "department", "location", "manager_group", "staff"]);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_side_quests")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, brief, completion_criteria, audience_type, audience_filters, starts_at, ends_at, points } = await req.json();
  const questPoints = Number.isInteger(points) ? points : 10;
  if (questPoints < 0 || questPoints > 1000) return NextResponse.json({ error: "Points must be between 0 and 1000." }, { status: 400 });
  if (!title?.trim() || !brief?.trim() || !completion_criteria?.trim()) return NextResponse.json({ error: "Title, brief and completion criteria are required." }, { status: 400 });
  if (!audiences.has(audience_type)) return NextResponse.json({ error: "Choose a valid eligible audience." }, { status: 400 });
  const filters = Array.isArray(audience_filters) ? [...new Set(audience_filters.filter((value): value is string => typeof value === "string" && Boolean(value.trim())))] : [];
  if (audience_type !== "company" && !filters.length) return NextResponse.json({ error: "Choose at least one eligible audience target." }, { status: 400 });
  if (starts_at && ends_at && new Date(starts_at) >= new Date(ends_at)) return NextResponse.json({ error: "The end time must be after the start time." }, { status: 400 });

  const now = new Date();
  const status = starts_at && new Date(starts_at) > now ? "upcoming" : "live";
  const { data, error } = await supabaseAdmin.from("side_quests").insert({ title: title.trim(), brief: brief.trim(), completion_criteria: completion_criteria.trim(), audience_type, audience_filters: filters, starts_at: starts_at || null, ends_at: ends_at || null, points: questPoints, status, created_by: session.user.id }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: (data as unknown as { id: string }).id });
}
