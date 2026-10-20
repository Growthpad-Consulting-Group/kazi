/**
 * Core Cache Engine
 *
 * Redis-backed cache with three properties that matter for this app:
 *
 *  1. Group-based invalidation — every key is indexed in a Redis set keyed by
 *     its group, so invalidating a group costs one SMEMBERS + one DEL batch
 *     instead of a SCAN over the whole keyspace.
 *  2. Single-flight — concurrent requests for the same key share one
 *     database round-trip rather than stampeding it (the "thundering herd"
 *     problem).
 *  3. Fail-open — any Redis error degrades to a plain database read. The
 *     cache must never be able to take the app down.
 */

import { redis } from "@/lib/redis";
import { CACHE_VERBOSE, isCacheEnabledFor, type CacheStrategyName, getCacheTTL } from "./config";
import { groupIndexKey, type CacheGroup } from "./groups";
import { recordHit, recordMiss, recordError } from "./monitoring";

/** In-flight loads, keyed by cache key. Guards against cache stampedes. */
const inFlight = new Map<string, Promise<unknown>>();

/** Longest-lived keys in a group set the index TTL, so the index outlives its keys. */
const INDEX_TTL_FACTOR = 3;
const INDEX_MIN_TTL = 3600;

function indexTTLFor(ttl: number): number {
  return Math.max(INDEX_MIN_TTL, ttl * INDEX_TTL_FACTOR);
}

/** Read a cached value. Returns null on a miss or any Redis failure. */
export async function getCached<T>(group: CacheGroup, key: string): Promise<T | null> {
  if (!isCacheEnabledFor(group)) return null;
  const started = Date.now();
  try {
    const value = await redis.get<T>(key);
    const elapsed = Date.now() - started;
    if (value === null || value === undefined) {
      recordMiss(group, elapsed);
      return null;
    }
    recordHit(group, elapsed);
    return value;
  } catch (error) {
    recordError(group, error);
    return null;
  }
}

/**
 * Write a value to the cache and index it under its group.
 *
 * The index write is best-effort: if it fails the value is still cached and
 * will expire on its own TTL — it just will not be invalidated early.
 */
export async function setCached<T>(
  group: CacheGroup,
  key: string,
  value: T,
  strategy: CacheStrategyName
): Promise<boolean> {
  if (!isCacheEnabledFor(group)) return false;
  if (value === undefined) return false;
  const ttl = getCacheTTL(strategy);
  try {
    await redis.set(key, value, { ex: ttl });
  } catch (error) {
    recordError(group, error);
    return false;
  }
  try {
    const index = groupIndexKey(group);
    await redis.sadd(index, key);
    await redis.expire(index, indexTTLFor(ttl));
  } catch (error) {
    recordError(group, error);
  }
  if (CACHE_VERBOSE) console.debug(`[cache] SET ${key} (ttl ${ttl}s)`);
  return true;
}

/** Delete a single key. */
export async function deleteCached(key: string): Promise<boolean> {
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    recordError("reference", error);
    return false;
  }
}

/**
 * Delete a single key and unindex it from its group.
 *
 * Used for targeted invalidation (e.g. one user's notifications) where
 * dropping the whole group would be needlessly destructive.
 */
export async function deleteCachedInGroup(group: CacheGroup, key: string): Promise<boolean> {
  try {
    await redis.del(key);
    // Best-effort: remove the key from the group index so a later group
    // invalidation does not try to delete an already-deleted key.
    await redis.srem(groupIndexKey(group), key);
    return true;
  } catch (error) {
    recordError(group, error);
    return false;
  }
}

/**
 * Delete every key in a group whose name matches a predicate.
 *
 * The group's index set is the source of truth for which keys exist, so this
 * costs one SMEMBERS plus a DEL batch — no keyspace scan. Used for keys that
 * embed their scope (e.g. `...goals:level=team&owner=<id>`) where the exact
 * key cannot be computed without knowing every filter combination.
 *
 * The result distinguishes "nothing matched" (nothing was stale) from
 * "Redis failed" (we cannot know what was stale, so the caller should fall
 * back to dropping the whole group).
 */
export async function deleteCachedInGroupMatching(
  group: CacheGroup,
  predicate: (key: string) => boolean
): Promise<{ removed: number; failed: boolean }> {
  try {
    const index = groupIndexKey(group);
    const keys = await redis.smembers<string[]>(index);
    if (!keys?.length) return { removed: 0, failed: false };
    const matches = keys.filter(predicate);
    if (matches.length === 0) return { removed: 0, failed: false };
    let removed = 0;
    const BATCH = 200;
    for (let i = 0; i < matches.length; i += BATCH) {
      removed += await redis.del(...matches.slice(i, i + BATCH));
    }
    // Drop the deleted keys from the index so they are not deleted twice.
    for (let i = 0; i < matches.length; i += BATCH) {
      await redis.srem(index, ...matches.slice(i, i + BATCH));
    }
    if (CACHE_VERBOSE) console.debug(`[cache] INVALIDATE group=${group} keys=${removed}`);
    return { removed, failed: false };
  } catch (error) {
    recordError(group, error);
    return { removed: 0, failed: true };
  }
}

/**
 * Read-through cache.
 *
 * Returns the cached value when present, otherwise runs `loader`, caches its
 * result, and returns it. Concurrent calls for the same key share a single
 * loader invocation.
 */
export async function cached<T>(
  group: CacheGroup,
  key: string,
  strategy: CacheStrategyName,
  loader: () => Promise<T>
): Promise<T> {
  if (!isCacheEnabledFor(group)) return loader();

  const hit = await getCached<T>(group, key);
  if (hit !== null) return hit;

  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = (async () => {
    try {
      const value = await loader();
      // Only cache non-empty results — an empty list is usually a transient
      // failure, and caching it would hide data until the TTL expired.
      if (value !== null && value !== undefined) {
        await setCached(group, key, value, strategy);
      }
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

/**
 * Invalidate every key in a group.
 *
 * @returns The number of keys removed.
 */
export async function invalidateGroup(group: CacheGroup): Promise<number> {
  const index = groupIndexKey(group);
  try {
    const keys = await redis.smembers<string[]>(index);
    if (!keys || keys.length === 0) {
      await redis.del(index);
      return 0;
    }
    let removed = 0;
    // Redis DEL is variadic, but keep batches bounded to stay well inside
    // request size limits on large deployments.
    const BATCH = 200;
    for (let i = 0; i < keys.length; i += BATCH) {
      removed += await redis.del(...keys.slice(i, i + BATCH));
    }
    await redis.del(index);
    if (CACHE_VERBOSE) console.debug(`[cache] INVALIDATE group=${group} keys=${removed}`);
    return removed;
  } catch (error) {
    recordError(group, error);
    return 0;
  }
}

/** Invalidate several groups at once. */
export async function invalidateGroups(groups: CacheGroup[]): Promise<number> {
  let total = 0;
  for (const group of groups) {
    total += await invalidateGroup(group);
  }
  return total;
}

/**
 * Remove every Kazi cache key, across all groups.
 *
 * Scans the namespace rather than iterating groups so that keys written
 * before a group was introduced are still cleared.
 */
export async function invalidateAll(): Promise<number> {
  try {
    let cursor = "0";
    const keys: string[] = [];
    do {
      const [next, found] = await redis.scan(cursor, { match: "kazi:*", count: 500 });
      cursor = next;
      keys.push(...found);
    } while (cursor !== "0");

    if (keys.length === 0) return 0;
    let removed = 0;
    const BATCH = 200;
    for (let i = 0; i < keys.length; i += BATCH) {
      removed += await redis.del(...keys.slice(i, i + BATCH));
    }
    return removed;
  } catch (error) {
    recordError("reference", error);
    return 0;
  }
}
