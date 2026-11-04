import { createHmac, timingSafeEqual } from "crypto";

/** Slack signs each request as v0=HMAC-SHA256(secret, "v0:<timestamp>:<raw body>"). */
export const MAX_SIGNATURE_AGE_SECONDS = 300;

export function verifySlackSignature({
  signingSecret,
  timestamp,
  rawBody,
  signature,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  signingSecret: string | undefined;
  timestamp: string | null;
  rawBody: string;
  signature: string | null;
  nowSeconds?: number;
}): boolean {
  if (!signingSecret || !timestamp || !signature) return false;
  const sent = Number(timestamp);
  if (!Number.isInteger(sent)) return false;
  // Reject old requests, which stops a captured request from being replayed.
  if (Math.abs(nowSeconds - sent) > MAX_SIGNATURE_AGE_SECONDS) return false;

  const expected =
    "v0=" +
    createHmac("sha256", signingSecret)
      .update(`v0:${timestamp}:${rawBody}`)
      .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
