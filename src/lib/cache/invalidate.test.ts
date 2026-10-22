import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis", async () => {
  const { mockRedis } = await import("@/test/mock-redis");
  return { redis: mockRedis, SCREENING_QUEUE: "kazi:screening:queue" };
});

import { mockRedis } from "@/test/mock-redis";
import { setCached } from "@/lib/cache/core";
import {
  cacheKey,
  checkinsCacheKey,
  goalsCacheKey,
  notificationsCacheKey,
  oneOnOnesCacheKey,
  privateFeedbackCacheKey,
  publicFeedbackCacheKey,
} from "@/lib/cache/groups";
import {
  invalidateOwnerGoals,
  invalidateOneOnOneParticipants,
  invalidatePublicFeedback,
  invalidateTables,
  invalidateUserCheckins,
  invalidateUserNotifications,
  invalidateUserPrivateFeedback,
} from "@/lib/cache/invalidate";

beforeEach(() => {
  mockRedis.__reset();
});

describe("invalidateTables", () => {
  it("drops the people group when users change", async () => {
    const people = cacheKey("staff", "list");
    await setCached("staff", people, [], "dynamic");

    await invalidateTables("users");

    expect(mockRedis.__has(people)).toBe(false);
  });

  it("drops the jobs and candidates groups when jobs change", async () => {
    const jobs = cacheKey("jobs", "list");
    const candidates = cacheKey("candidates", "list");
    await setCached("jobs", jobs, [], "dynamic");
    await setCached("candidates", candidates, [], "dynamic");

    await invalidateTables("jobs");

    expect(mockRedis.__has(jobs)).toBe(false);
    expect(mockRedis.__has(candidates)).toBe(false);
  });

  it("drops the pulse group when check-ins change", async () => {
    const checkins = cacheKey("pulse", "checkins", "me", "u1");
    await setCached("pulse", checkins, [], "realtime");

    await invalidateTables("checkins");

    expect(mockRedis.__has(checkins)).toBe(false);
  });

  it("ignores unknown tables", async () => {
    await expect(invalidateTables("does_not_exist")).resolves.toBe(0);
  });

  it("leaves unrelated groups intact", async () => {
    const people = cacheKey("staff", "list");
    const notifications = cacheKey("notifications", "user", "u1");
    await setCached("staff", people, [], "dynamic");
    await setCached("notifications", notifications, [], "realtime");

    await invalidateTables("checkins");

    expect(mockRedis.__has(people)).toBe(true);
    expect(mockRedis.__has(notifications)).toBe(true);
  });
});

describe("invalidateUserNotifications", () => {
  it("drops only the targeted user's notifications", async () => {
    const u1 = notificationsCacheKey("u1");
    const u2 = notificationsCacheKey("u2");
    await setCached("notifications", u1, [], "realtime");
    await setCached("notifications", u2, [], "realtime");

    await invalidateUserNotifications("u1");

    expect(mockRedis.__has(u1)).toBe(false);
    expect(mockRedis.__has(u2)).toBe(true);
  });

  it("falls back to dropping the whole group when Redis fails", async () => {
    const u1 = notificationsCacheKey("u1");
    await setCached("notifications", u1, [], "realtime");

    mockRedis.redisState.failing = true;
    await expect(invalidateUserNotifications("u1")).resolves.toBeUndefined();
  });
});

describe("invalidateUserCheckins", () => {
  it("drops only the owner's cached check-ins", async () => {
    const u1 = checkinsCacheKey("u1");
    const u2 = checkinsCacheKey("u2");
    await setCached("pulse", u1, [], "realtime");
    await setCached("pulse", u2, [], "realtime");

    await invalidateUserCheckins("u1");

    expect(mockRedis.__has(u1)).toBe(false);
    expect(mockRedis.__has(u2)).toBe(true);
  });

  it("drops the dashboard group, which aggregates check-in status", async () => {
    const dash = cacheKey("dashboard", "v2", "range");
    await setCached("dashboard", dash, [], "dynamic");
    await setCached("pulse", checkinsCacheKey("u1"), [], "realtime");

    await invalidateUserCheckins("u1");

    expect(mockRedis.__has(dash)).toBe(false);
  });

  it("drops the whole pulse group when the owner is unknown", async () => {
    const u1 = checkinsCacheKey("u1");
    await setCached("pulse", u1, [], "realtime");

    await invalidateUserCheckins("");

    expect(mockRedis.__has(u1)).toBe(false);
  });
});

describe("invalidateUserPrivateFeedback", () => {
  it("drops only the recipient's private feedback", async () => {
    const u1 = privateFeedbackCacheKey("u1");
    const u2 = privateFeedbackCacheKey("u2");
    await setCached("pulse", u1, [], "realtime");
    await setCached("pulse", u2, [], "realtime");

    await invalidateUserPrivateFeedback("u1");

    expect(mockRedis.__has(u1)).toBe(false);
    expect(mockRedis.__has(u2)).toBe(true);
  });
});

describe("invalidatePublicFeedback", () => {
  it("drops every cached public-feedback wall, whatever the limit", async () => {
    const p20 = publicFeedbackCacheKey(20);
    const p50 = publicFeedbackCacheKey(50);
    await setCached("pulse", p20, [], "dynamic");
    await setCached("pulse", p50, [], "dynamic");

    await invalidatePublicFeedback();

    expect(mockRedis.__has(p20)).toBe(false);
    expect(mockRedis.__has(p50)).toBe(false);
  });

  it("leaves private feedback alone", async () => {
    const priv = privateFeedbackCacheKey("u1");
    await setCached("pulse", priv, [], "realtime");

    await invalidatePublicFeedback();

    expect(mockRedis.__has(priv)).toBe(true);
  });
});

describe("invalidateOwnerGoals", () => {
  it("drops the owner's goal lists and the unfiltered list", async () => {
    const mine = goalsCacheKey({ ownerId: "u1" });
    const mineByLevel = goalsCacheKey({ ownerId: "u1", level: "team" });
    const all = goalsCacheKey();
    const theirs = goalsCacheKey({ ownerId: "u2" });
    await setCached("pulse", mine, [], "dynamic");
    await setCached("pulse", mineByLevel, [], "dynamic");
    await setCached("pulse", all, [], "dynamic");
    await setCached("pulse", theirs, [], "dynamic");

    await invalidateOwnerGoals("u1");

    expect(mockRedis.__has(mine)).toBe(false);
    expect(mockRedis.__has(mineByLevel)).toBe(false);
    expect(mockRedis.__has(all)).toBe(false);
    // Another owner's filtered list is still valid.
    expect(mockRedis.__has(theirs)).toBe(true);
  });

  it("does not drop another owner whose id merely starts with the same prefix", async () => {
    const u1 = goalsCacheKey({ ownerId: "u1" });
    const u12 = goalsCacheKey({ ownerId: "u12" });
    await setCached("pulse", u1, [], "dynamic");
    await setCached("pulse", u12, [], "dynamic");

    await invalidateOwnerGoals("u1");

    expect(mockRedis.__has(u1)).toBe(false);
    expect(mockRedis.__has(u12)).toBe(true);
  });

  it("drops the level-only list, which also contains this owner's goals", async () => {
    const byLevel = goalsCacheKey({ level: "team" });
    const otherOwnerByLevel = goalsCacheKey({ ownerId: "u2", level: "team" });
    await setCached("pulse", byLevel, [], "dynamic");
    await setCached("pulse", otherOwnerByLevel, [], "dynamic");

    await invalidateOwnerGoals("u1");

    expect(mockRedis.__has(byLevel)).toBe(false);
    expect(mockRedis.__has(otherOwnerByLevel)).toBe(true);
  });

  it("drops the whole group when the owner is unknown", async () => {
    const all = goalsCacheKey();
    await setCached("pulse", all, [], "dynamic");

    await invalidateOwnerGoals("");

    expect(mockRedis.__has(all)).toBe(false);
  });
});

describe("invalidateOneOnOneParticipants", () => {
  it("drops the two participants' lists but not other managers'", async () => {
    const mine = oneOnOnesCacheKey({ managerId: "m1" });
    const asReport = oneOnOnesCacheKey({ reportId: "r1" });
    const other = oneOnOnesCacheKey({ managerId: "m2" });
    await setCached("pulse", mine, [], "dynamic");
    await setCached("pulse", asReport, [], "dynamic");
    await setCached("pulse", other, [], "dynamic");

    await invalidateOneOnOneParticipants({ managerId: "m1", reportId: "r1" });

    expect(mockRedis.__has(mine)).toBe(false);
    expect(mockRedis.__has(asReport)).toBe(false);
    expect(mockRedis.__has(other)).toBe(true);
  });

  it("does not drop another manager whose id merely starts with the same prefix", async () => {
    const m1 = oneOnOnesCacheKey({ managerId: "m1" });
    const m12 = oneOnOnesCacheKey({ managerId: "m12" });
    await setCached("pulse", m1, [], "dynamic");
    await setCached("pulse", m12, [], "dynamic");

    await invalidateOneOnOneParticipants({ managerId: "m1" });

    expect(mockRedis.__has(m1)).toBe(false);
    expect(mockRedis.__has(m12)).toBe(true);
  });
});

describe("Redis failure fallback", () => {
  it("never throws when Redis is unavailable", async () => {
    mockRedis.redisState.failing = true;

    await expect(invalidateUserNotifications("u1")).resolves.toBeUndefined();
    await expect(invalidateUserCheckins("u1")).resolves.toBeUndefined();
    await expect(invalidateUserPrivateFeedback("u1")).resolves.toBeUndefined();
    await expect(invalidatePublicFeedback()).resolves.toBeUndefined();
    await expect(invalidateOwnerGoals("u1")).resolves.toBeUndefined();
    await expect(
      invalidateOneOnOneParticipants({ managerId: "m1", reportId: "r1" })
    ).resolves.toBeUndefined();
  });

  it("fails open when Redis is down: the key survives but nothing throws", async () => {
    const u1 = publicFeedbackCacheKey(20);
    await setCached("pulse", u1, [], "dynamic");

    // Redis is unavailable, so neither the targeted delete nor the broader
    // group invalidation can run. The cache must degrade gracefully — the
    // entry simply expires on its own TTL.
    mockRedis.redisState.failing = true;
    await expect(invalidatePublicFeedback()).resolves.toBeUndefined();
    mockRedis.redisState.failing = false;

    expect(mockRedis.__has(u1)).toBe(true);
  });

  it("falls back to the exact keys when the group index has drifted", async () => {
    // The key exists but the index lost it (e.g. the index expired first).
    const mine = oneOnOnesCacheKey({ managerId: "m1" });
    await mockRedis.set(mine, JSON.stringify([]));

    await invalidateOneOnOneParticipants({ managerId: "m1" });

    expect(mockRedis.__has(mine)).toBe(false);
  });
});
