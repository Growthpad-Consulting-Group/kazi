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
}: AwardPointsArgs): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("award_reward_points", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_reference_type: referenceType ?? null,
    p_reference_id: referenceId ?? null,
    p_created_by: createdBy ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}
