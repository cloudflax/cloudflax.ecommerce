import * as Sentry from '@sentry/nextjs';
import { redis } from '@/lib/redis';

export type RateLimitBucket = {
  key: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  /** Seconds until the blocking bucket resets. 0 when allowed. */
  retryAfter: number;
};

function readNumber(reply: [Error | null, unknown] | undefined): number {
  if (!reply) throw new Error('Redis pipeline returned fewer replies than commands');
  const [error, value] = reply;
  if (error) throw error;
  if (typeof value !== 'number') throw new Error(`Unexpected Redis reply: ${String(value)}`);
  return value;
}

/**
 * Increments every bucket and reports whether all of them are still under their
 * limit. All buckets are counted even once one has failed, so a caller that
 * checks both an email and an IP counter keeps both in sync.
 *
 * Throws if Redis is unreachable — callers fail closed by design (see
 * docs/PLAN-SECURITY-AUTH.md, decision 2).
 */
export async function rateLimitMany(buckets: RateLimitBucket[]): Promise<RateLimitResult> {
  try {
    if (buckets.length === 0) return { allowed: true, retryAfter: 0 };

    const counters = redis.pipeline();
    for (const { key } of buckets) {
      counters.incr(key);
      counters.ttl(key);
    }
    const replies = await counters.exec();
    if (!replies) throw new Error('Redis pipeline was aborted');

    const expirations = redis.pipeline();
    let allowed = true;
    let retryAfter = 0;

    buckets.forEach((bucket, index) => {
      const count = readNumber(replies[index * 2]);
      const ttl = readNumber(replies[index * 2 + 1]);

      // -1 means the key exists with no TTL: either we just created it with INCR,
      // or a previous EXPIRE never landed. Without this the counter would stay
      // above the limit forever and lock the bucket permanently.
      if (ttl < 0) expirations.expire(bucket.key, bucket.windowSeconds);

      if (count > bucket.limit) {
        allowed = false;
        retryAfter = Math.max(retryAfter, ttl > 0 ? ttl : bucket.windowSeconds);
      }
    });

    if (expirations.length > 0) await expirations.exec();

    return { allowed, retryAfter };
  } catch (error) {
    // V11 — Redis down means nobody can log in (fail-closed, by decision 2).
    // Make sure ops hears about it through Sentry instead of user reports.
    Sentry.captureException(error);
    throw error;
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  return rateLimitMany([{ key, limit, windowSeconds }]);
}

/** User-facing wait text for a RateLimitResult.retryAfter. */
export function formatRetryAfter(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, seconds)} segundos`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
}
