import { supabaseAdmin } from "@/lib/supabase";
import {
  pickCultureSpotlight,
  type CultureSpotlight,
} from "./culture-spotlight";

// reward_wallets and reward_catalogue are read through the generated types;
// feedback is queried here only for the signed-in user's own recognition.
export async function loadCultureSpotlight(
  userId: string,
  now: Date,
): Promise<CultureSpotlight | null> {
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const [feedback, wallet, catalogue] = await Promise.all([
    supabaseAdmin
      .from("feedback")
      .select("created_at")
      .eq("to_user_id", userId)
      .eq("visibility", "public")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("reward_wallets")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("reward_catalogue")
      .select(
        "points_cost, stock_quantity, available_from, expires_at, reward_type",
      )
      .eq("is_active", true)
      .eq("reward_type", "reward"),
  ]);

  const recent = feedback.data ?? [];
  const recentRecognition = recent.length
    ? {
        count: recent.length,
        latestAt: new Date(recent[0].created_at),
      }
    : null;

  const available = (catalogue.data ?? []).filter((item) => {
    if (item.available_from && new Date(item.available_from) > now)
      return false;
    if (item.expires_at && new Date(item.expires_at) < now) return false;
    return item.stock_quantity === null || item.stock_quantity > 0;
  });
  const cheapestCost = available.length
    ? Math.min(...available.map((item) => item.points_cost))
    : null;
  const balance = wallet.data?.balance ?? 0;

  return pickCultureSpotlight(
    {
      recentRecognition,
      rewards: cheapestCost === null ? null : { balance, cheapestCost },
    },
    now,
  );
}
