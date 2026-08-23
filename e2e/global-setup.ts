import 'dotenv/config';
import Redis from 'ioredis';

// Clears rate-limit keys before the e2e suite: the specs count attempts
// against Redis, and leftovers from a previous run would make them flaky
// (e.g. the per-IP buckets tripping early).
const RATE_LIMIT_PREFIXES = ['login:*', 'register:*', 'resend:*', 'reset:*'];

export default async function globalSetup() {
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    lazyConnect: true,
  });

  for (const prefix of RATE_LIMIT_PREFIXES) {
    const keys = await redis.keys(prefix);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  await redis.quit();
}
