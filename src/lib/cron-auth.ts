import { timingSafeEqual } from "node:crypto";

/** Reject scheduled work unless a configured secret exactly matches the bearer token. */
export function hasCronAccess(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
