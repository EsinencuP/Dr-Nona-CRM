import { prisma } from "../../src/lib/prisma";
import { createHash } from "node:crypto";

export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
  reason?: "limit" | "identity_unavailable" | "store_unavailable";
};

export type RateLimitIncrement = (input: {
  id: string;
  clientKey: string;
  windowStart: Date;
  expiresAt: Date;
  now: Date;
}) => Promise<number>;

type RateLimitOptions = {
  limit?: number;
  windowMs?: number;
  now?: () => number;
  increment?: RateLimitIncrement;
};

const DEFAULT_LIMIT = 5;
const DEFAULT_WINDOW_MS = 60_000;

export function createPrismaRateLimitIncrement(db = prisma): RateLimitIncrement {
  return async function incrementPersistentBucket(input) {
    const [bucket] = await db.$transaction([
      db.applicationRateLimitBucket.upsert({
        where: { id: input.id },
        create: {
          id: input.id,
          clientKey: input.clientKey,
          windowStart: input.windowStart,
          expiresAt: input.expiresAt,
          attempts: 1,
        },
        update: { attempts: { increment: 1 } },
        select: { attempts: true },
      }),
      db.applicationRateLimitBucket.deleteMany({ where: { expiresAt: { lte: input.now }, id: { not: input.id } } }),
    ]);
    return bucket.attempts;
  };
}

export function createApplicationRateLimitGuard(options: RateLimitOptions = {}) {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const now = options.now ?? Date.now;
  const increment = options.increment ?? createPrismaRateLimitIncrement();

  return async function applicationRateLimitGuard(request: Request): Promise<RateLimitDecision> {
    const currentTime = now();
    const clientKey = request.headers.get("x-dr-nona-client-key") ?? "";
    if (!/^[A-Za-z0-9_-]{43}$/u.test(clientKey)) {
      return { allowed: false, retryAfterSeconds: 30, reason: "identity_unavailable" };
    }
    const windowStartMs = Math.floor(currentTime / windowMs) * windowMs;
    const resetAt = windowStartMs + windowMs;
    const id = createHash("sha256").update(`${clientKey}:${windowStartMs}`).digest("base64url");
    let attempts: number;
    try {
      attempts = await increment({
        id,
        clientKey,
        windowStart: new Date(windowStartMs),
        expiresAt: new Date(resetAt + windowMs),
        now: new Date(currentTime),
      });
    } catch {
      return { allowed: false, retryAfterSeconds: 30, reason: "store_unavailable" };
    }
    if (attempts > limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - currentTime) / 1000)),
        reason: "limit",
      };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  };
}

export const applicationRateLimitGuard = createApplicationRateLimitGuard();
