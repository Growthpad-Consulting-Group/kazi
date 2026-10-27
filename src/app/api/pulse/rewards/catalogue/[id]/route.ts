import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "manage_rewards")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;

  const body = await req.json().catch(() => null) as { name?: unknown; description?: unknown; points_cost?: unknown; image_url?: unknown; is_active?: unknown } | null;
  const update: Partial<{ name: string; description: string | null; points_cost: number; image_url: string | null; is_active: boolean }> = {};
  if (body?.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    update.name = body.name.trim();
  }
  if (body?.description !== undefined) update.description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  if (body?.points_cost !== undefined) {
    if (typeof body.points_cost !== "number" || !Number.isInteger(body.points_cost) || body.points_cost <= 0) return NextResponse.json({ error: "Points cost must be a whole number above zero." }, { status: 400 });
    update.points_cost = body.points_cost;
  }
  if (body?.image_url !== undefined) update.image_url = typeof body.image_url === "string" && body.image_url.trim() ? body.image_url.trim() : null;
  if (body?.is_active !== undefined) update.is_active = Boolean(body.is_active);
  if (!Object.keys(update).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { error } = await supabaseAdmin.from("reward_catalogue").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, context: RouteContext): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "manage_rewards")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;

  const { count, error: countError } = await supabaseAdmin
    .from("reward_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("catalogue_item_id", id);
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  if (count) return NextResponse.json({ error: "This reward has redemption history. Hide it instead so its records stay intact." }, { status: 409 });

  const { error } = await supabaseAdmin.from("reward_catalogue").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
