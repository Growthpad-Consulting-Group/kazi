import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis", async () => {
  const { mockRedis } = await import("@/test/mock-redis");
  return { redis: mockRedis, SCREENING_QUEUE: "kazi:screening:queue" };
});

/**
 * Supabase is stubbed with a chainable builder so that each test can assert
 * the exact query the cache layer issued, and control the rows it returns.
 */
const supabaseState = {
  rows: [] as unknown[],
  error: null as { message: string } | null,
  calls: [] as { table: string; filters: Record<string, unknown> }[],
};

function makeBuilder(table: string) {
  const filters: Record<string, unknown> = {};
  const builder: Record<string, unknown> = {};
  const chain = ["select", "order", "limit", "single", "maybeSingle", "in", "gte", "lte", "not"];
  for (const method of chain) {
    builder[method] = () => builder;
  }
  builder.eq = (col: string, value: unknown) => {
    filters[col] = value;
    return builder;
  };
  builder.then = (resolve: (v: unknown) => void) => {
    supabaseState.calls.push({ table, filters });
    resolve({ data: supabaseState.rows, error: supabaseState.error });
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => makeBuilder(table),
  },
}));

import { mockRedis } from "@/test/mock-redis";
import {
  getCachedMyCheckins,
  getCachedNotifications,
  getCachedPeople,
  getCachedPrivateFeedback,
  getCachedPublicFeedback,
} from "@/lib/cache/queries";
import { notificationsCacheKey } from "@/lib/cache/groups";
import { resetCacheStats } from "@/lib/cache/monitoring";

beforeEach(() => {
  mockRedis.__reset();
  resetCacheStats();
  supabaseState.rows = [];
  supabaseState.error = null;
  supabaseState.calls = [];
});

describe("user-scoped queries", () => {
  it("keys check-ins by user id", async () => {
    supabaseState.rows = [{ id: "c1", user_id: "u1" }];
    await getCachedMyCheckins("u1");

    expect(supabaseState.calls[0].filters).toEqual({ user_id: "u1" });
    expect(mockRedis.__has("kazi:pulse:checkins:me:u1")).toBe(true);
  });

  it("never serves one user's check-ins to another user", async () => {
    supabaseState.rows = [{ id: "c1", user_id: "u1" }];
    const forU1 = await getCachedMyCheckins("u1");

    supabaseState.rows = [{ id: "c2", user_id: "u2" }];
    const forU2 = await getCachedMyCheckins("u2");

    expect(forU1).toEqual([{ id: "c1", user_id: "u1" }]);
    expect(forU2).toEqual([{ id: "c2", user_id: "u2" }]);
    expect(supabaseState.calls).toHaveLength(2);
  });

  it("keys private feedback by recipient id", async () => {
    supabaseState.rows = [];
    await getCachedPrivateFeedback("u9");

    expect(supabaseState.calls[0].filters).toEqual({ to_user_id: "u9", visibility: "private" });
    expect(mockRedis.__has("kazi:pulse:feedback:private:u9")).toBe(true);
  });

  it("keys notifications by recipient id", async () => {
    supabaseState.rows = [];
    await getCachedNotifications("u3");

    expect(supabaseState.calls[0].filters).toEqual({ user_id: "u3" });
    expect(notificationsCacheKey("u3")).toBe("kazi:notifications:user:u3");
  });

  it("shares public feedback across users", async () => {
    supabaseState.rows = [{ id: "f1" }];
    await getCachedPublicFeedback(20);
    await getCachedPublicFeedback(20);

    expect(supabaseState.calls).toHaveLength(1);
  });

  it("shares the people directory across users", async () => {
    supabaseState.rows = [{ id: "u1" }];
    await getCachedPeople();
    await getCachedPeople();

    expect(supabaseState.calls).toHaveLength(1);
    expect(mockRedis.__has("kazi:people:list")).toBe(true);
  });
});

describe("fail-open behaviour", () => {
  it("returns database rows when Redis is down", async () => {
    mockRedis.redisState.failing = true;
    supabaseState.rows = [{ id: "u1" }];

    const people = await getCachedPeople();

    expect(people).toEqual([{ id: "u1" }]);
  });

  it("still applies the user filter when Redis is down", async () => {
    mockRedis.redisState.failing = true;
    supabaseState.rows = [];

    await getCachedNotifications("u7");

    expect(supabaseState.calls[0].filters).toEqual({ user_id: "u7" });
  });
});
