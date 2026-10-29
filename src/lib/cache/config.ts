/**
 * Cache Configuration & Feature Flags
 *
 * Mirrors the tiered-TTL approach used in bflowpos: reference data gets a long
 * TTL, business data a medium one, and live operational data a short one.
 *
 * Flags (all optional, set in .env.local):
 *   CACHE_ENABLED=false              → disables all caching
 *   CACHE_GROUPS=people,candidates   → only cache these groups (empty = all)
 *   CACHE_EXCLUDE_GROUPS=notifications→ never cache these groups
 *   CACHE_VERBOSE=true               → log hits/misses
 */

/** Master switch — caching is on unless explicitly disabled. */
export const CACHE_ENABLED = process.env.CACHE_ENABLED !== "false";

/** Log every hit/miss to the console. */
export const CACHE_VERBOSE = process.env.CACHE_VERBOSE === "true";

export type CacheCategory = "stable" | "dynamic" | "realtime";

export interface CacheStrategy {
  /** Time-to-live in seconds. */
  ttl: number;
  /** Bucket the TTL belongs to — used for reporting and rollout decisions. */
  category: CacheCategory;
  description: string;
}

export const CACHE_STRATEGIES = {
  /** Reference data that changes rarely (departments, org structure). */
  stable: {
    ttl: 1800,
    category: "stable",
    description: "Reference data that rarely changes",
  },
  /** Business data that changes throughout the day (people, jobs, pipeline). */
  dynamic: {
    ttl: 300,
    category: "dynamic",
    description: "Business data that changes regularly",
  },
  /** Operational data that must feel live (check-ins, notifications). */
  realtime: {
    ttl: 30,
    category: "realtime",
    description: "Live operational data",
  },
} as const;

export type CacheStrategyName = keyof typeof CACHE_STRATEGIES;

/** Resolve a strategy name to its TTL, falling back to `dynamic`. */
export function getCacheTTL(strategy: CacheStrategyName): number {
  return CACHE_STRATEGIES[strategy]?.ttl ?? CACHE_STRATEGIES.dynamic.ttl;
}

/** Resolve a strategy name to its full descriptor. */
export function getCacheStrategy(strategy: CacheStrategyName): CacheStrategy {
  return CACHE_STRATEGIES[strategy] ?? CACHE_STRATEGIES.dynamic;
}

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/**
 * Groups explicitly allowed to cache. Empty means "all groups" (when the
 * master switch is on). Use it to roll caching out one area at a time.
 */
const ENABLED_GROUPS = parseList(process.env.CACHE_GROUPS);

/** Groups that must never be cached. Takes precedence over the allow list. */
const EXCLUDED_GROUPS = parseList(process.env.CACHE_EXCLUDE_GROUPS);

/** Whether caching is active for a given group. */
export function isCacheEnabledFor(group: string): boolean {
  if (!CACHE_ENABLED) return false;
  if (EXCLUDED_GROUPS.includes(group)) return false;
  if (ENABLED_GROUPS.length > 0 && !ENABLED_GROUPS.includes(group))
    return false;
  return true;
}
