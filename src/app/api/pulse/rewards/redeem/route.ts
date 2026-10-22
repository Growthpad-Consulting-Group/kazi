import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { catalogue_item_id } = await req.json();
  if (!catalogue_item_id) {
    return NextResponse.json({ error: "catalogue_item_id is required." }, { status: 400 });
  }

  // Fetch active catalogue item
  const { data: item, error: itemError } = await supabaseAdmin
    .from("reward_catalogue")
    .select("id, name, points_cost")
    .eq("id", catalogue_item_id)
    .eq("is_active", true)
    .maybeSingle();

  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });
  if (!item) return NextResponse.json({ error: "Item not found or unavailable." }, { status: 404 });

  // Fetch wallet balance
  const { data: wallet, error: walletError } = await supabaseAdmin
    .from("reward_wallets")
    .select("balance")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (walletError) return NextResponse.json({ error: walletError.message }, { status: 500 });
  const balance = wallet?.balance ?? 0;
  if (balance < item.points_cost) {
    return NextResponse.json({ error: "Insufficient points." }, { status: 400 });
  }

  // Insert redemption
  const { data: redemption, error: redemptionError } = await supabaseAdmin
    .from("reward_redemptions")
    .insert({
      user_id: session.user.id,
      catalogue_item_id: item.id,
      points_spent: item.points_cost,
    })
    .select("id")
    .single();

  if (redemptionError) return NextResponse.json({ error: redemptionError.message }, { status: 500 });

  // Deduct points from wallet
  const { error: updateError } = await supabaseAdmin
    .from("reward_wallets")
    .update({ balance: balance - item.points_cost })
    .eq("user_id", session.user.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Insert ledger entry
  await supabaseAdmin.from("reward_ledger").insert({
    user_id: session.user.id,
    amount: -item.points_cost,
    reason: `Redeemed: ${item.name}`,
    reference_type: "redemption",
    reference_id: redemption.id,
    created_by: session.user.id,
  });

  return NextResponse.json({ id: redemption.id }, { status: 201 });
}
