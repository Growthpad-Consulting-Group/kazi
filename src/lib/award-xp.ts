import { supabaseAdmin } from "@/lib/supabase";

type AwardXpArgs = {
  userId: string;
  amount: number;
  reason: string;
  referenceType?: string;
  referenceId?: string;
  createdBy?: string | null;
};

export async function awardQuarterlyXp({
  userId,
  amount,
  reason,
  referenceType,
  referenceId,
  createdBy,
}: AwardXpArgs): Promise<boolean> {
  if (amount <= 0) return false;
  const { data, error } = await supabaseAdmin.rpc("award_quarterly_xp", {
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
