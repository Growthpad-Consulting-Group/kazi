import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { catalogue_item_id } = await req.json(); if (!catalogue_item_id) return NextResponse.json({ error: "Choose a reward." }, { status: 400 });
  const [{ data: item }, { data: wallet }] = await Promise.all([supabaseAdmin.from("reward_catalogue").select("id,name,points_cost").eq("id", catalogue_item_id).eq("is_active", true).maybeSingle(), supabaseAdmin.from("reward_wallets").select("balance").eq("user_id", session.user.id).maybeSingle()]);
  if (!item) return NextResponse.json({ error: "This reward is unavailable." }, { status: 404 });
  if ((wallet?.balance ?? 0) < item.points_cost) return NextResponse.json({ error: "Insufficient points." }, { status: 400 });
  const { data: redemption, error } = await supabaseAdmin.from("reward_redemptions").insert({ user_id: session.user.id, catalogue_item_id: item.id, points_spent: item.points_cost }).select("id").single(); if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { error: walletError } = await supabaseAdmin.from("reward_wallets").update({ balance: wallet!.balance - item.points_cost }).eq("user_id", session.user.id); if (walletError) return NextResponse.json({ error: walletError.message }, { status: 500 });
  await supabaseAdmin.from("reward_ledger").insert({ user_id: session.user.id, amount: -item.points_cost, reason: `Redeemed: ${item.name}`, reference_type: "redemption", reference_id: (redemption as { id: string }).id, created_by: session.user.id });
  return NextResponse.json({ id: redemption.id });
}
