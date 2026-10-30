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

  const {
    name,
    description,
    points_cost,
    image_url,
    category,
    vendor_name,
    fulfilment_instructions,
    stock_quantity,
    redemption_limit_per_user,
    available_from,
    expires_at,
  } = await req.json();

  if (!name?.trim())
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!Number.isInteger(points_cost) || points_cost <= 0) {
    return NextResponse.json(
      { error: "points_cost must be a positive number." },
      { status: 400 },
    );
  }
  if (
    stock_quantity !== undefined &&
    stock_quantity !== null &&
    (!Number.isInteger(stock_quantity) || stock_quantity < 0)
  )
    return NextResponse.json(
      { error: "Stock must be a whole number or unlimited." },
      { status: 400 },
    );
  if (
    redemption_limit_per_user !== undefined &&
    redemption_limit_per_user !== null &&
    (!Number.isInteger(redemption_limit_per_user) ||
      redemption_limit_per_user < 1)
  )
    return NextResponse.json(
      { error: "Redemption limit must be a whole number above zero." },
      { status: 400 },
    );

  const { data, error } = await supabaseAdmin
    .from("reward_catalogue")
    .insert({
      name: name.trim(),
      description: description?.trim() ?? null,
      points_cost,
      image_url: image_url ?? null,
      category:
        typeof category === "string" && category.trim()
          ? category.trim()
          : null,
      vendor_name:
        typeof vendor_name === "string" && vendor_name.trim()
          ? vendor_name.trim()
          : null,
      fulfilment_instructions:
        typeof fulfilment_instructions === "string" &&
        fulfilment_instructions.trim()
          ? fulfilment_instructions.trim()
          : null,
      stock_quantity: stock_quantity ?? null,
      redemption_limit_per_user: redemption_limit_per_user ?? null,
      available_from: available_from || null,
      expires_at: expires_at || null,
    })
    .select("id")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
