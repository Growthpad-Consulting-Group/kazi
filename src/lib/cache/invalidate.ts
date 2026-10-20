/**
 * Cache Invalidation
 *
 * A single entry point for "this data changed, drop what you have cached".
 *
 * Mutation code calls one of these helpers after a successful write. Keeping
 * the group mapping in one file means there is exactly one place to look when
 * asking "what does editing a job invalidate?".
 */

import {
  deleteCachedInGroup,
  deleteCachedInGroupMatching,
  invalidateGroup,
  invalidateGroups,
} from "./core";
import {
  checkinsCacheKey,
  notificationsCacheKey,
  oneOnOnesCacheKey,
  privateFeedbackCacheKey,
  GOALS_KEY_PREFIX,
  ONE_ON_ONES_KEY_PREFIX,
  PUBLIC_FEEDBACK_KEY_PREFIX,
} from "./groups";
import type { CacheGroup } from "./groups";

/**
 * Invalidate the groups affected by a change to a table.
 *
 * The mapping is deliberately conservative: when in doubt, drop more rather
 * than serve a stale value.
 */
const TABLE_GROUPS: Record<string, CacheGroup[]> = {
  users: ["people", "dashboard", "pulse"],
  departments: ["reference", "people", "jobs", "dashboard"],
  jobs: ["jobs", "candidates", "dashboard", "reference"],
  candidates: ["candidates", "dashboard", "jobs"],
  candidate_notes: ["candidates"],
  interview_scorecards: ["candidates"],
  checkins: ["pulse", "dashboard"],
  goals: ["pulse"],
  feedback: ["pulse"],
  one_on_ones: ["pulse"],
  idps: ["pulse"],
  pips: ["pulse"],
  performance_reviews: ["pulse", "dashboard"],
  review_cycles: ["pulse", "dashboard"],
  surveys: ["pulse"],
  survey_responses: ["pulse"],
  notifications: ["notifications"],
};

/** Invalidate every group affected by a change to the given tables. */
export async function invalidateTables(...tables: string[]): Promise<number> {
  const groups = new Set<CacheGroup>();
  for (const table of tables) {
    for (const group of TABLE_GROUPS[table] ?? []) groups.add(group);
  }
  if (groups.size === 0) return 0;
  return invalidateGroups(Array.from(groups));
}

/** Invalidate a single group. */
export async function invalidateCacheGroup(group: CacheGroup): Promise<number> {
  return invalidateGroup(group);
}

/**
 * Match a filter segment inside a cache-key suffix.
 *
 * The suffix is built by `filterSuffix`, which joins `key=value` pairs with
 * "&" in a stable order. A plain `includes("owner=u1")` would also match
 * `owner=u12`, so the segment boundaries are enforced explicitly. The first
 * segment is preceded by ":" (the key separator), the rest by "&".
 */
function hasFilterSegment(key: string, segment: string, value: string): boolean {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|&|:)${segment}=${escaped}(&|$)`).test(key);
}

/** Whether a filter segment is present at all, whatever its value. */
function hasSegment(key: string, segment: string): boolean {
  return new RegExp(`(^|&|:)${segment}=[^&]*(&|$)`).test(key);
}

/**
 * Invalidate the notifications of a single user.
 *
 * Notifications are per-user, so reading or dismissing one user's notification
 * must not evict every other user's cached list. Falls back to dropping the
 * whole group if the targeted delete fails.
 */
export async function invalidateUserNotifications(userId: string): Promise<void> {
  const deleted = await deleteCachedInGroup("notifications", notificationsCacheKey(userId));
  if (!deleted) await invalidateGroup("notifications");
}

/**
 * Invalidate one user's cached check-ins.
 *
 * Check-ins are private to their owner, so editing someone's check-in must
 * only drop that person's key. The `dashboard` group is dropped as well
 * because the pulse dashboard aggregates check-in status across the org.
 */
export async function invalidateUserCheckins(userId: string): Promise<void> {
  if (!userId) {
    // We could not determine the owner — drop the whole pulse group to be
    // safe rather than risk serving a stale check-in.
    await invalidateGroup("pulse");
    await invalidateCacheGroup("dashboard");
    return;
  }
  const deleted = await deleteCachedInGroup("pulse", checkinsCacheKey(userId));
  if (!deleted) {
    await invalidateGroup("pulse");
    return;
  }
  await invalidateCacheGroup("dashboard");
}

/**
 * Invalidate the private feedback addressed to one user.
 *
 * Only the recipient's private list is affected — the public wall is only
 * touched when the feedback was actually public.
 */
export async function invalidateUserPrivateFeedback(userId: string): Promise<void> {
  const deleted = await deleteCachedInGroup("pulse", privateFeedbackCacheKey(userId));
  if (!deleted) await invalidateGroup("pulse");
}

/**
 * Invalidate the organisation-wide public feedback wall.
 *
 * Every cached public-feedback key is dropped, whatever its `limit`, so that
 * new praise appears immediately for everyone.
 */
export async function invalidatePublicFeedback(): Promise<void> {
  const { removed, failed } = await deleteCachedInGroupMatching(
    "pulse",
    (key) => key.startsWith(PUBLIC_FEEDBACK_KEY_PREFIX)
  );
  // Nothing matched means nothing was cached for the wall — that is fine.
  // A failure means we cannot know, so drop the whole group to be safe.
  if (failed) await invalidateGroup("pulse");
  void removed;
}

/**
 * Invalidate the goals cached for one owner.
 *
 * Goal lists are cached per filter combination (owner and/or level), so the
 * exact key cannot always be computed — the owner's id is matched against the
 * group's key index instead. Two kinds of keys are affected:
 *
 *  - the unfiltered "all" list, which contains every goal;
 *  - any list filtered by level but not by owner, which also contains this
 *    owner's goals (a list scoped to another owner is left alone).
 */
export async function invalidateOwnerGoals(ownerId: string): Promise<void> {
  if (!ownerId) {
    // A goal without a visible owner could appear in anyone's filtered list.
    await invalidateGroup("pulse");
    return;
  }
  const { failed } = await deleteCachedInGroupMatching("pulse", (key) => {
    if (!key.startsWith(GOALS_KEY_PREFIX)) return false;
    if (key === `${GOALS_KEY_PREFIX}all`) return true;
    // Scoped to this owner.
    if (hasFilterSegment(key, "owner", ownerId)) return true;
    // Not scoped to any owner, so it contains this owner's goals as well.
    return !hasSegment(key, "owner");
  });
  if (failed) await invalidateGroup("pulse");
}

/**
 * Invalidate the one-on-ones visible to a manager or a report.
 *
 * A one-on-one is visible to exactly two people, so only lists mentioning
 * either participant are dropped — other managers keep their cached lists.
 */
export async function invalidateOneOnOneParticipants(params: {
  managerId?: string;
  reportId?: string;
}): Promise<void> {
  const { removed, failed } = await deleteCachedInGroupMatching("pulse", (key) => {
    if (!key.startsWith(ONE_ON_ONES_KEY_PREFIX)) return false;
    if (key === `${ONE_ON_ONES_KEY_PREFIX}all`) return true;
    if (params.managerId && hasFilterSegment(key, "manager", params.managerId)) return true;
    if (params.reportId && hasFilterSegment(key, "report", params.reportId)) return true;
    return false;
  });
  if (failed) {
    // Redis is unhappy — drop the whole group rather than risk a stale list.
    await invalidateGroup("pulse");
  } else if (removed === 0) {
    // Nothing matched the index. The exact keys may still exist if the index
    // was lost, so try them directly.
    await deleteCachedInGroup(
      "pulse",
      oneOnOnesCacheKey({ managerId: params.managerId })
    );
    await deleteCachedInGroup(
      "pulse",
      oneOnOnesCacheKey({ reportId: params.reportId })
    );
  }
}
