import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const SCREENING_QUEUE = "kazi:screening:queue";
export const SCREENING_PROCESSING = "kazi:screening:processing";
// A set complements the FIFO list so repeated application retries or bulk-screen
// requests cannot place the same candidate in the queue more than once.
export const SCREENING_PENDING = "kazi:screening:pending";

/** Adds a candidate to the screening queue once. Returns false when already queued. */
export async function enqueueScreeningCandidate(candidateId: string) {
  const added = await redis.sadd(SCREENING_PENDING, candidateId);
  if (!added) return false;
  await redis.rpush(SCREENING_QUEUE, candidateId);
  return true;
}
