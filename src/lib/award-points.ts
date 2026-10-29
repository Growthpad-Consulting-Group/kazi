import { supabaseAdmin } from "@/lib/supabase";

interface AwardPointsArgs {
  userId: string;
  amount: number;
  reason: string;
  referenceType?: string;
  referenceId?: string;
  createdBy?: string | null;
}

export async function awardPoints({
  userId,
  amount,
  reason,
  referenceType,
  referenceId,
  createdBy,
}: AwardPointsArgs): Promise<void> {
  // Ensure wallet exists
  await supabaseAdmin
    .from("reward_wallets")
    .upsert(
      { user_id: userId, balance: 0 },
      { onConflict: "user_id", ignoreDuplicates: true },
    );

  // Fetch current balance and increment
  const { data: wallet } = await supabaseAdmin
    .from("reward_wallets")
    .select("balance")
    .eq("user_id", userId)
    .single();

  await supabaseAdmin
    .from("reward_wallets")
    .update({ balance: (wallet?.balance ?? 0) + amount })
    .eq("user_id", userId);

  // Ledger entry
  await supabaseAdmin.from("reward_ledger").insert({
    user_id: userId,
    amount,
    reason,
    reference_type: referenceType ?? null,
    reference_id: referenceId ?? null,
    created_by: createdBy ?? null,
  });
}
