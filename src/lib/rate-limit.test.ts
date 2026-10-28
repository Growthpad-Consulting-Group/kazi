import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis", async () => {
  const { mockRedis } = await import("@/test/mock-redis");
  return { redis: mockRedis };
});

import { checkRateLimit, requestIp } from "@/lib/rate-limit";
import { mockRedis } from "@/test/mock-redis";

beforeEach(() => mockRedis.__reset());

describe("request rate limits", () => {
  it("allows requests up to the configured limit, then blocks the next request", async () => {
    const options = { scope: "test", identifier: "198.51.100.4", limit: 2, windowSeconds: 60 };
    expect((await checkRateLimit(options)).allowed).toBe(true);
    expect((await checkRateLimit(options)).allowed).toBe(true);
    expect((await checkRateLimit(options)).allowed).toBe(false);
  });

  it("keeps independent identifiers separate", async () => {
    const options = { scope: "test", limit: 1, windowSeconds: 60 };
    await checkRateLimit({ ...options, identifier: "first" });
    expect((await checkRateLimit({ ...options, identifier: "second" })).allowed).toBe(true);
  });

  it("fails closed when Redis is unavailable", async () => {
    mockRedis.redisState.failing = true;
    expect((await checkRateLimit({ scope: "test", identifier: "first", limit: 1, windowSeconds: 60 })).allowed).toBe(false);
  });

  it("uses the first forwarded address as the request identity", () => {
    expect(requestIp(new Headers({ "x-forwarded-for": "203.0.113.1, 70.41.3.18" }))).toBe("203.0.113.1");
  });
});
