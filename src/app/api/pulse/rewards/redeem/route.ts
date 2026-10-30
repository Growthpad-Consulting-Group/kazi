import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { notifyRoles } from "@/lib/notifications";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { catalogue_item_id } = await req.json();
  if (!catalogue_item_id)
    return NextResponse.json({ error: "Choose a reward." }, { status: 400 });
  const { data, error } = await supabaseAdmin.rpc("redeem_reward" as never, {
    p_user_id: session.user.id,
    p_catalogue_item_id: catalogue_item_id,
  } as never);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  const redemptionId = data as string;
  const { data: item } = await supabaseAdmin
    .from("reward_catalogue")
    .select("name")
    .eq("id", catalogue_item_id)
    .maybeSingle();
  await notifyRoles(
    ["admin", "hr"],
    `${session.user.name ?? "A staff member"} requested: ${item?.name ?? "a reward"}`,
    "/pulse/rewards",
  );
  return NextResponse.json({ id: redemptionId });
}
