import { supabaseAdmin } from "@/lib/supabase";
import type { WallOfFameCategory } from "@/lib/wall-of-fame-category-rules";

export type { WallOfFameCategory } from "@/lib/wall-of-fame-category-rules";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table
const db = supabaseAdmin as any;

/** Award categories in display order. Retired categories are left out unless asked for. */
export async function loadWallOfFameCategories({
  includeRetired = false,
}: { includeRetired?: boolean } = {}): Promise<WallOfFameCategory[]> {
  let query = db
    .from("wall_of_fame_categories")
    .select(
      "key, label, description, purpose, criteria, icon, sort_order, active",
    )
    .order("sort_order", { ascending: true });
  if (!includeRetired) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as WallOfFameCategory[]).map((row) => ({
    ...row,
    criteria: Array.isArray(row.criteria) ? row.criteria : [],
  }));
}
