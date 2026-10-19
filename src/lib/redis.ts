import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const SCREENING_QUEUE = "kazi:screening:queue";
export const SCREENING_PROCESSING = "kazi:screening:processing";
