import { describe, expect, it, vi } from "vitest";
import { hasCronAccess } from "./cron-auth";

describe("hasCronAccess", () => {
  it("requires a configured exact bearer secret", () => {
    vi.stubEnv("CRON_SECRET", "scheduled-secret");
    expect(hasCronAccess(new Request("https://kazi.test", { headers: { authorization: "Bearer scheduled-secret" } }))).toBe(true);
    expect(hasCronAccess(new Request("https://kazi.test", { headers: { authorization: "Bearer wrong" } }))).toBe(false);
  });

  it("does not accept a literal undefined secret", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(hasCronAccess(new Request("https://kazi.test", { headers: { authorization: "Bearer undefined" } }))).toBe(false);
  });
});
