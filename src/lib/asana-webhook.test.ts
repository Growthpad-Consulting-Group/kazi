import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { asanaEventKey, verifyAsanaWebhookSignature } from "./asana-webhook";

describe("verifyAsanaWebhookSignature", () => {
  const secret = "webhook-secret";
  const body = '{"events":[]}';
  const sig = createHmac("sha256", secret).update(body).digest("hex");

  it("accepts a matching signature", () => {
    expect(verifyAsanaWebhookSignature(secret, body, sig)).toBe(true);
  });

  it("rejects a changed body, a wrong secret or a missing header", () => {
    expect(verifyAsanaWebhookSignature(secret, body + " ", sig)).toBe(false);
    expect(verifyAsanaWebhookSignature("other", body, sig)).toBe(false);
    expect(verifyAsanaWebhookSignature(secret, body, null)).toBe(false);
  });
});

describe("asanaEventKey", () => {
  it("is stable for the same event and differs between events", () => {
    const event = {
      action: "changed",
      created_at: "2026-11-04T10:00:00.000Z",
      user: { gid: "u1" },
      resource: { gid: "t1" },
    };
    expect(asanaEventKey(event)).toBe(asanaEventKey({ ...event }));
    expect(asanaEventKey(event)).not.toBe(
      asanaEventKey({ ...event, created_at: "2026-11-04T10:00:01.000Z" }),
    );
  });

  it("returns null when an event is missing its identifying fields", () => {
    expect(asanaEventKey({ action: "added" })).toBeNull();
  });
});
