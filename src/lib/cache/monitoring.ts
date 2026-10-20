/**
 * Cache Monitoring
 *
 * Tracks hit/miss/error counts and latency per group, in-process. These
 * counters are surfaced by the cache stats API so that cache effectiveness
 * can be verified in production rather than assumed.
 */

import type { CacheGroup } from "./groups";
import { CACHE_VERBOSE } from "./config";

export interface CacheGroupStats {
  group: string;
  hits: number;
  misses: number;
  errors: number;
  /** Total time spent in Redis calls for this group. */
  totalLatencyMs: number;
  hitRate: number;
  avgLatencyMs: number;
}

const stats = new Map<string, CacheGroupStats>();

function bucket(group: string): CacheGroupStats {
  let entry = stats.get(group);
  if (!entry) {
    entry = { group, hits: 0, misses: 0, errors: 0, totalLatencyMs: 0, hitRate: 0, avgLatencyMs: 0 };
    stats.set(group, entry);
  }
  return entry;
}

export function recordHit(group: string, latencyMs: number): void {
  const entry = bucket(group);
  entry.hits += 1;
  entry.totalLatencyMs += latencyMs;
  recompute(entry);
}

export function recordMiss(group: string, latencyMs: number): void {
  const entry = bucket(group);
  entry.misses += 1;
  entry.totalLatencyMs += latencyMs;
  recompute(entry);
}

export function recordError(group: string, error: unknown): void {
  const entry = bucket(group);
  entry.errors += 1;
  if (CACHE_VERBOSE) {
    console.warn(`[cache] ERROR in group=${group}:`, (error as Error)?.message ?? error);
  }
}

function recompute(entry: CacheGroupStats): void {
  const total = entry.hits + entry.misses;
  entry.hitRate = total > 0 ? entry.hits / total : 0;
  entry.avgLatencyMs = total > 0 ? Math.round(entry.totalLatencyMs / total) : 0;
}

/** Snapshot of all group statistics. */
export function getCacheStats(): CacheGroupStats[] {
  return Array.from(stats.values()).map((entry) => ({ ...entry }));
}

/** Aggregate totals across all groups. */
export function getCacheSummary(): {
  hits: number;
  misses: number;
  errors: number;
  hitRate: number;
  avgLatencyMs: number;
} {
  const all = getCacheStats();
  const hits = all.reduce((sum, e) => sum + e.hits, 0);
  const misses = all.reduce((sum, e) => sum + e.misses, 0);
  const errors = all.reduce((sum, e) => sum + e.errors, 0);
  const total = hits + misses;
  const totalLatency = all.reduce((sum, e) => sum + e.totalLatencyMs, 0);
  return {
    hits,
    misses,
    errors,
    hitRate: total > 0 ? hits / total : 0,
    avgLatencyMs: total > 0 ? Math.round(totalLatency / total) : 0,
  };
}

/** Reset counters — used by tests. */
export function resetCacheStats(): void {
  stats.clear();
}

export type { CacheGroup };
