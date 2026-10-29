/**
 * Cache Groups
 *
 * A "group" is a logical slice of cached data (people, jobs, dashboard, …).
 * Every cached key belongs to exactly one group, and every group has a set of
 * Redis sets that track its keys. That lets us invalidate a whole slice of
 * the cache with a couple of round-trips instead of scanning the keyspace.
 */

export const CACHE_GROUPS = [
  /** Reference data: departments, org structure. */
  "reference",
  /** Employee directory. */
  "staff",
  /** Job postings. */
  "jobs",
  /** Candidates and the hiring pipeline. */
  "candidates",
  /** Aggregated dashboard + reporting metrics. */
  "dashboard",
  /** Pulse check-ins, goals, feedback, 1-on-1s, PIPs, IDPs. */
  "pulse",
  /** In-app notifications. */
  "notifications",
] as const;

export type CacheGroup = (typeof CACHE_GROUPS)[number];

/** Root namespace — keeps Kazi keys from colliding with anything else in Redis. */
export const CACHE_NAMESPACE = "kazi";

/** Prefix of the Redis set that indexes the keys of a group. */
export function groupIndexKey(group: CacheGroup): string {
  return `${CACHE_NAMESPACE}:idx:${group}`;
}

/**
 * Build a cache key.
 *
 * @param group  The group the key belongs to (drives invalidation).
 * @param parts  Key segments, joined with ":".
 */
export function cacheKey(
  group: CacheGroup,
  ...parts: (string | number)[]
): string {
  return [CACHE_NAMESPACE, group, ...parts].join(":");
}

/**
 * Normalise a filter object into a stable cache-key suffix.
 *
 * Object key order must not affect the result, otherwise two identical
 * queries would produce two different keys and one would never be hit.
 */
export function filterSuffix(
  filters?: Record<string, string | number | boolean | null | undefined>,
): string {
  if (!filters) return "all";
  const entries = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return entries.length > 0 ? entries.join("&") : "all";
}

/**
 * Cache key for a user's notifications.
 *
 * Lives here rather than in the query layer so that the invalidation layer
 * can target a single user's key without importing the database layer.
 */
export function notificationsCacheKey(userId: string): string {
  return cacheKey("notifications", "user", userId);
}

/**
 * Cache key for a user's own check-ins.
 *
 * User-scoped: one user must never see another user's cached check-ins.
 */
export function checkinsCacheKey(userId: string): string {
  return cacheKey("pulse", "checkins", "me", userId);
}

/**
 * Cache key for the private feedback addressed to one user.
 *
 * User-scoped, and deliberately separate from the public wall so that
 * public praise and private notes never share a key.
 */
export function privateFeedbackCacheKey(userId: string): string {
  return cacheKey("pulse", "feedback", "private", userId);
}

/** Cache key for the organisation-wide public feedback wall. */
export function publicFeedbackCacheKey(limit: number): string {
  return cacheKey("pulse", "feedback", "public", limit);
}

/**
 * Cache key for a goals query.
 *
 * The owner filter is part of the key, so goals can be invalidated per owner
 * without disturbing the other users' goal lists.
 */
export function goalsCacheKey(filters?: {
  ownerId?: string;
  level?: string;
}): string {
  return cacheKey(
    "pulse",
    "goals",
    filterSuffix({ owner: filters?.ownerId, level: filters?.level }),
  );
}

/** Cache key for a one-on-one list, filtered by manager and/or report. */
export function oneOnOnesCacheKey(params: {
  managerId?: string;
  reportId?: string;
}): string {
  return cacheKey(
    "pulse",
    "one-on-ones",
    filterSuffix({ manager: params.managerId, report: params.reportId }),
  );
}

/** Prefix shared by every cached goals entry. */
export const GOALS_KEY_PREFIX = `${CACHE_NAMESPACE}:pulse:goals:`;

/** Prefix shared by every cached one-on-one entry. */
export const ONE_ON_ONES_KEY_PREFIX = `${CACHE_NAMESPACE}:pulse:one-on-ones:`;

/** Prefix shared by every cached public-feedback entry. */
export const PUBLIC_FEEDBACK_KEY_PREFIX = `${CACHE_NAMESPACE}:pulse:feedback:public:`;
