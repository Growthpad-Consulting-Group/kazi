import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ADMIN_ROLES, hasRole } from "@/lib/rbac";
import {
  CACHE_ENABLED,
  CACHE_GROUPS,
  CACHE_STRATEGIES,
  getCacheStats,
  getCacheSummary,
  isCacheEnabledFor,
} from "@/lib/cache";

/**
 * Cache statistics.
 *
 * Restricted to administrators — the numbers describe internal cache behaviour
 * and should not be exposed to every authenticated user.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(session.user.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const groups = CACHE_GROUPS.map((group) => ({
    group,
    enabled: isCacheEnabledFor(group),
  }));

  return NextResponse.json({
    enabled: CACHE_ENABLED,
    groups,
    strategies: CACHE_STRATEGIES,
    summary: getCacheSummary(),
    stats: getCacheStats(),
  });
}
