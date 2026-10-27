import { supabaseAdmin } from "@/lib/supabase";

// The proxy checks this on page requests, so keep a short per-instance cache. A change takes
// effect everywhere within this window.
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: boolean; loadedAt: number }>();

export async function mustChangePassword(userId: string): Promise<boolean> {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) return cached.value;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the flag is newer than the generated types
  const { data } = await (supabaseAdmin as any).from("users").select("must_change_password").eq("id", userId).maybeSingle();
  const value = Boolean((data as { must_change_password?: boolean } | null)?.must_change_password);
  cache.set(userId, { value, loadedAt: Date.now() });
  return value;
}

export function clearMustChangePassword(userId: string) {
  cache.delete(userId);
}
