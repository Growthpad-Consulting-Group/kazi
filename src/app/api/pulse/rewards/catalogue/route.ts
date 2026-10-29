import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("reward_catalogue")
    .select("*")
    .eq("is_active", true)
    .order("points_cost", { ascending: true });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "manage_rewards")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, description, points_cost, image_url } = await req.json();

  if (!name?.trim())
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (typeof points_cost !== "number" || points_cost <= 0) {
    return NextResponse.json(
      { error: "points_cost must be a positive number." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("reward_catalogue")
    .insert({
      name: name.trim(),
      description: description?.trim() ?? null,
      points_cost,
      image_url: image_url ?? null,
    })
    .select("id")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
