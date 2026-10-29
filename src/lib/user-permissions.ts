import { supabaseAdmin } from "@/lib/supabase";
import type { GrantablePermission } from "@/lib/rbac";

// Grants change rarely. A per-instance cache keeps the session callback and proxy cheap. A change
// clears the cache on the server that made it, and reaches other servers within this window.
const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { value: string[]; loadedAt: number }>();

export async function getExtraPermissions(userId: string): Promise<string[]> {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS)
    return cached.value;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- user_permissions is newer than the generated types
  const { data, error } = await (supabaseAdmin as any)
    .from("user_permissions")
    .select("permission")
    .eq("user_id", userId);
  if (error) throw new Error(`Could not load permissions: ${error.message}`);
  const value = ((data ?? []) as { permission: string }[]).map(
    (row) => row.permission,
  );
  cache.set(userId, { value, loadedAt: Date.now() });
  return value;
}

export async function setExtraPermission(
  userId: string,
  permission: GrantablePermission,
  granted: boolean,
  grantedBy: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- user_permissions is newer than the generated types
  const table = (supabaseAdmin as any).from("user_permissions");
  const { error } = granted
    ? await table.upsert(
        { user_id: userId, permission, granted_by: grantedBy },
        { onConflict: "user_id,permission" },
      )
    : await table.delete().eq("user_id", userId).eq("permission", permission);
  if (error) throw new Error(`Could not update permissions: ${error.message}`);
  cache.delete(userId);
}
