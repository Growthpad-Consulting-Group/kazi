/* eslint-disable @typescript-eslint/no-explicit-any -- role_page_access is not in the generated Supabase types yet */
import { supabaseAdmin } from "@/lib/supabase";
import { GATED_PAGES, GRANTABLE_ROLES } from "@/lib/page-access";
import type { UserRole } from "@/types/database";

// Grants change rarely. A short per-instance cache keeps the proxy and session from
// querying on every request; a change takes effect everywhere within this window.
const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<UserRole, { paths: string[]; loadedAt: number }>();

/** The pages a role may open, or ["*"] for admin. */
export async function getAllowedPaths(role: UserRole): Promise<string[]> {
  if (role === "admin") return ["*"];

  const cached = cache.get(role);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS)
    return cached.paths;

  const { data, error } = await (supabaseAdmin as any)
    .from("role_page_access")
    .select("page_path")
    .eq("role", role);
  if (error)
    throw new Error(`Could not load page access for ${role}: ${error.message}`);

  const paths = (data as { page_path: string }[]).map((row) => row.page_path);
  cache.set(role, { paths, loadedAt: Date.now() });
  return paths;
}

/** Every grant for the grantable roles, for the roles matrix. */
export async function listPageGrants(): Promise<
  { role: string; page_path: string }[]
> {
  const { data, error } = await (supabaseAdmin as any)
    .from("role_page_access")
    .select("role, page_path");
  if (error) throw new Error(`Could not load page grants: ${error.message}`);
  return data as { role: string; page_path: string }[];
}

export function isGrantableRole(
  role: string,
): role is (typeof GRANTABLE_ROLES)[number] {
  return (GRANTABLE_ROLES as readonly string[]).includes(role);
}

export function isGatedPath(path: string): boolean {
  return GATED_PAGES.some((page) => page.path === path);
}

/** Adds or removes one grant, then drops this instance's cache so the change shows up at once. */
export async function setPageGrant(
  role: (typeof GRANTABLE_ROLES)[number],
  path: string,
  granted: boolean,
) {
  const table = (supabaseAdmin as any).from("role_page_access");
  const { error } = granted
    ? await table.upsert(
        { role, page_path: path },
        { onConflict: "role,page_path" },
      )
    : await table.delete().eq("role", role).eq("page_path", path);
  if (error) throw new Error(`Could not update page access: ${error.message}`);
  cache.delete(role);
}
