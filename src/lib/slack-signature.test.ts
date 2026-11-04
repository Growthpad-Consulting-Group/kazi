import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { verifySlackSignature } from "./slack-signature";

const secret = "test-signing-secret";
const body = "command=%2Fkazi&text=today&user_id=U1";
const now = 1_800_000_000;

function sign(timestamp: string, raw: string) {
  return (
    "v0=" +
    createHmac("sha256", secret).update(`v0:${timestamp}:${raw}`).digest("hex")
  );
}

describe("verifySlackSignature", () => {
  it("accepts a correctly signed, recent request", () => {
    expect(
      verifySlackSignature({
        signingSecret: secret,
        timestamp: String(now),
        rawBody: body,
        signature: sign(String(now), body),
        nowSeconds: now,
      }),
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(
      verifySlackSignature({
        signingSecret: secret,
        timestamp: String(now),
        rawBody: body + "&extra=1",
        signature: sign(String(now), body),
        nowSeconds: now,
      }),
    ).toBe(false);
  });

  it("rejects a request older than five minutes", () => {
    expect(
      verifySlackSignature({
        signingSecret: secret,
        timestamp: String(now - 400),
        rawBody: body,
        signature: sign(String(now - 400), body),
        nowSeconds: now,
      }),
    ).toBe(false);
  });

  it("rejects everything when no secret is configured", () => {
    expect(
      verifySlackSignature({
        signingSecret: undefined,
        timestamp: String(now),
        rawBody: body,
        signature: sign(String(now), body),
        nowSeconds: now,
      }),
    ).toBe(false);
  });

  it("rejects missing headers and non-numeric timestamps", () => {
    expect(
      verifySlackSignature({
        signingSecret: secret,
        timestamp: null,
        rawBody: body,
        signature: "v0=x",
        nowSeconds: now,
      }),
    ).toBe(false);
    expect(
      verifySlackSignature({
        signingSecret: secret,
        timestamp: "abc",
        rawBody: body,
        signature: "v0=x",
        nowSeconds: now,
      }),
    ).toBe(false);
  });
});
