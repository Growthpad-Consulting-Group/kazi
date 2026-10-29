import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Upstash client before the cache layer imports it.
vi.mock("@/lib/redis", async () => {
  const { mockRedis } = await import("@/test/mock-redis");
  return { redis: mockRedis, SCREENING_QUEUE: "kazi:screening:queue" };
});

import { mockRedis } from "@/test/mock-redis";
import {
  cached,
  deleteCachedInGroup,
  deleteCachedInGroupMatching,
  getCached,
  invalidateAll,
  invalidateGroup,
  setCached,
} from "@/lib/cache/core";
import { cacheKey, filterSuffix, groupIndexKey } from "@/lib/cache/groups";
import {
  getCacheStats,
  getCacheSummary,
  resetCacheStats,
} from "@/lib/cache/monitoring";

beforeEach(() => {
  mockRedis.__reset();
  resetCacheStats();
});

describe("cache keys", () => {
  it("namespaces keys by group", () => {
    expect(cacheKey("staff", "list")).toBe("kazi:staff:list");
    expect(cacheKey("pulse", "checkins", "me", "u1")).toBe(
      "kazi:pulse:checkins:me:u1",
    );
  });

  it("builds a distinct group index key", () => {
    expect(groupIndexKey("jobs")).toBe("kazi:idx:jobs");
  });

  it("produces a stable suffix regardless of filter key order", () => {
    expect(filterSuffix({ b: "2", a: "1" })).toBe(
      filterSuffix({ a: "1", b: "2" }),
    );
    expect(filterSuffix({ a: "1" })).toBe("a=1");
  });

  it("falls back to 'all' for empty filters", () => {
    describe("cached()", () => {
      it("returns the cached value on a hit without re-running the loader", async () => {
        const loader = vi.fn().mockResolvedValue([1, 2, 3]);
        const key = cacheKey("staff", "list");

        const first = await cached("staff", key, "dynamic", loader);
        const second = await cached("staff", key, "dynamic", loader);

        expect(first).toEqual([1, 2, 3]);
        expect(second).toEqual([1, 2, 3]);
        expect(loader).toHaveBeenCalledTimes(1);
      });

      it("records a hit and a miss in the monitoring counters", async () => {
        const key = cacheKey("staff", "list");
        await cached("staff", key, "dynamic", async () => "value");
        await cached("staff", key, "dynamic", async () => "value");

        const stats = getCacheStats().find((s) => s.group === "staff");
        expect(stats?.hits).toBe(1);
        expect(stats?.misses).toBe(1);
        expect(stats?.hitRate).toBe(0.5);
      });

      it("shares a single loader call between concurrent callers (single-flight)", async () => {
        let resolveLoader: (v: string[]) => void = () => {};
        const loader = vi.fn(
          () =>
            new Promise<string[]>((resolve) => {
              resolveLoader = resolve;
            }),
        );
        const key = cacheKey("jobs", "list");

        const a = cached("jobs", key, "dynamic", loader);
        const b = cached("jobs", key, "dynamic", loader);
        const c = cached("jobs", key, "dynamic", loader);

        resolveLoader(["x"]);
        const [ra, rb, rc] = await Promise.all([a, b, c]);

        expect(loader).toHaveBeenCalledTimes(1);
        expect(ra).toEqual(["x"]);
        expect(rb).toEqual(["x"]);
        expect(rc).toEqual(["x"]);
      });

      it("fails open to the loader when Redis is unavailable", async () => {
        mockRedis.redisState.failing = true;
        const loader = vi.fn().mockResolvedValue("fallback");

        const result = await cached(
          "staff",
          cacheKey("staff", "list"),
          "dynamic",
          loader,
        );

        expect(result).toBe("fallback");
        expect(loader).toHaveBeenCalledTimes(1);
        expect(getCacheSummary().errors).toBeGreaterThan(0);
      });

      it("propagates loader errors and does not cache them", async () => {
        const key = cacheKey("jobs", "list");
        const loader = vi.fn().mockRejectedValue(new Error("boom"));

        await expect(cached("jobs", key, "dynamic", loader)).rejects.toThrow(
          "boom",
        );
        expect(mockRedis.__has(key)).toBe(false);
      });

      it("applies the TTL of the chosen strategy", async () => {
        const key = cacheKey("notifications", "user", "u1");
        await setCached("notifications", key, { ok: true }, "realtime");
        expect(mockRedis.__ttl(key)).toBe(30);

        const stableKey = cacheKey("reference", "departments");
        await setCached("reference", stableKey, ["a"], "stable");
        expect(mockRedis.__ttl(stableKey)).toBe(1800);
      });

      it("indexes written keys under their group", async () => {
        await cached(
          "staff",
          cacheKey("staff", "list"),
          "dynamic",
          async () => [],
        );
        expect(mockRedis.__setIndexSize("staff")).toBe(1);
      });
    });

    expect(filterSuffix()).toBe("all");
    expect(filterSuffix({})).toBe("all");
    expect(filterSuffix({ a: "", b: null })).toBe("all");
  });
});

describe("invalidation", () => {
  it("removes every key in a group", async () => {
    const a = cacheKey("jobs", "list");
    const b = cacheKey("jobs", "detail", "j1");
    await setCached("jobs", a, 1, "dynamic");
    await setCached("jobs", b, 2, "dynamic");

    const removed = await invalidateGroup("jobs");

    expect(removed).toBe(2);
    expect(mockRedis.__has(a)).toBe(false);
    expect(mockRedis.__has(b)).toBe(false);
  });

  it("leaves other groups untouched", async () => {
    const jobs = cacheKey("jobs", "list");
    const people = cacheKey("staff", "list");
    await setCached("jobs", jobs, 1, "dynamic");
    await setCached("staff", people, 1, "dynamic");

    await invalidateGroup("jobs");

    expect(mockRedis.__has(jobs)).toBe(false);
    expect(mockRedis.__has(people)).toBe(true);
  });

  it("removes a single key and unindexes it", async () => {
    const key = cacheKey("notifications", "user", "u1");
    await setCached("notifications", key, [1], "realtime");

    const ok = await deleteCachedInGroup("notifications", key);

    expect(ok).toBe(true);
    expect(mockRedis.__has(key)).toBe(false);
    expect(mockRedis.__setIndexSize("notifications")).toBe(0);
  });

  it("removes every kazi key across groups with invalidateAll", async () => {
    await setCached("jobs", cacheKey("jobs", "list"), 1, "dynamic");
    await setCached("staff", cacheKey("staff", "list"), 1, "dynamic");

    const removed = await invalidateAll();

    expect(removed).toBe(2);
    expect(mockRedis.__has(cacheKey("jobs", "list"))).toBe(false);
  });

  it("fails open when Redis errors during invalidation", async () => {
    mockRedis.redisState.failing = true;
    await expect(invalidateGroup("jobs")).resolves.toBe(0);
  });
});

describe("deleteCachedInGroupMatching", () => {
  it("removes only the keys the predicate matches", async () => {
    const match = cacheKey("pulse", "goals", "owner=u1");
    const other = cacheKey("pulse", "goals", "owner=u2");
    const unrelated = cacheKey("pulse", "checkins", "me", "u1");
    await setCached("pulse", match, 1, "dynamic");
    await setCached("pulse", other, 1, "dynamic");
    await setCached("pulse", unrelated, 1, "dynamic");

    const result = await deleteCachedInGroupMatching("pulse", (key) =>
      key.includes("owner=u1"),
    );

    expect(result).toEqual({ removed: 1, failed: false });
    expect(mockRedis.__has(match)).toBe(false);
    expect(mockRedis.__has(other)).toBe(true);
    expect(mockRedis.__has(unrelated)).toBe(true);
  });

  it("unindexes the deleted keys so a later group invalidation skips them", async () => {
    const match = cacheKey("pulse", "goals", "owner=u1");
    const other = cacheKey("pulse", "goals", "owner=u2");
    await setCached("pulse", match, 1, "dynamic");
    await setCached("pulse", other, 1, "dynamic");

    await deleteCachedInGroupMatching("pulse", (key) =>
      key.includes("owner=u1"),
    );

    expect(mockRedis.__setIndexSize("pulse")).toBe(1);
  });

  it("reports 'no match' rather than a failure when nothing matches", async () => {
    await setCached(
      "pulse",
      cacheKey("pulse", "goals", "owner=u1"),
      1,
      "dynamic",
    );

    const result = await deleteCachedInGroupMatching("pulse", (key) =>
      key.includes("nope="),
    );

    expect(result).toEqual({ removed: 0, failed: false });
  });

  it("reports a failure when the group index cannot be read", async () => {
    mockRedis.redisState.failing = true;

    const result = await deleteCachedInGroupMatching("pulse", () => true);

    expect(result).toEqual({ removed: 0, failed: true });
  });
});

describe("getCached / setCached", () => {
  it("returns null for a missing key", async () => {
    expect(await getCached("staff", cacheKey("staff", "missing"))).toBeNull();
  });

  it("returns null instead of throwing when Redis fails", async () => {
    mockRedis.redisState.failing = true;
    expect(await getCached("staff", cacheKey("staff", "list"))).toBeNull();
  });

  it("does not write when Redis fails", async () => {
    mockRedis.redisState.failing = true;
    expect(
      await setCached("staff", cacheKey("staff", "list"), 1, "dynamic"),
    ).toBe(false);
  });
});
