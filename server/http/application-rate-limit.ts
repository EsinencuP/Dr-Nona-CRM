import { createHash } from "node:crypto";

export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type RateLimitBucket = {
  attempts: number;
  resetAt: number;
};

type RateLimitOptions = {
  limit?: number;
  windowMs?: number;
  maxBuckets?: number;
  now?: () => number;
};

const DEFAULT_LIMIT = 5;
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_BUCKETS = 10_000;

function clientAddress(request: Request) {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "address-unavailable";

  return forwarded.split(",", 1)[0]?.trim() || "address-unavailable";
}

function anonymizedClientKey(request: Request) {
  return createHash("sha256").update(clientAddress(request)).digest("base64url");
}

export function createApplicationRateLimitGuard(options: RateLimitOptions = {}) {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxBuckets = options.maxBuckets ?? DEFAULT_MAX_BUCKETS;
  const now = options.now ?? Date.now;
  const buckets = new Map<string, RateLimitBucket>();
  let nextSweepAt = 0;

  return async function applicationRateLimitGuard(request: Request): Promise<RateLimitDecision> {
    const currentTime = now();

    if (currentTime >= nextSweepAt || buckets.size >= maxBuckets) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= currentTime) buckets.delete(key);
      }
      nextSweepAt = currentTime + windowMs;
    }
    while (buckets.size >= maxBuckets) {
      const oldestKey = buckets.keys().next().value as string | undefined;
      if (!oldestKey) break;
      buckets.delete(oldestKey);
    }

    const key = anonymizedClientKey(request);
    const existing = buckets.get(key);
    const bucket =
      existing && existing.resetAt > currentTime ? existing : { attempts: 0, resetAt: currentTime + windowMs };

    if (bucket.attempts >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000)),
      };
    }

    bucket.attempts += 1;
    buckets.set(key, bucket);
    return { allowed: true, retryAfterSeconds: 0 };
  };
}

export const applicationRateLimitGuard = createApplicationRateLimitGuard();
