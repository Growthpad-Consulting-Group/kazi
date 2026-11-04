import { createHmac, timingSafeEqual } from "crypto";

/** Asana signs each delivery with HMAC-SHA256(secret, raw body), hex-encoded, in X-Hook-Signature. */
export function verifyAsanaWebhookSignature(
  secret: string,
  rawBody: string,
  signature: string | null,
): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type AsanaEvent = {
  action?: string;
  created_at?: string;
  user?: { gid?: string } | null;
  resource?: { gid?: string; resource_type?: string } | null;
};

/**
 * A stable key for one Asana event. The same event delivered by a webhook and
 * later found by reconciliation produces the same key, so it is stored once.
 */
export function asanaEventKey(event: AsanaEvent): string | null {
  const resource = event.resource?.gid;
  const action = event.action;
  const at = event.created_at;
  if (!resource || !action || !at) return null;
  return [resource, action, at, event.user?.gid ?? "system"].join("|");
}
