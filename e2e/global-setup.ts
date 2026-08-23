import 'dotenv/config';
import Redis from 'ioredis';

// Clears `login:*` rate-limit keys before the e2e suite: the specs count
// attempts against Redis, and leftovers from a previous run would make them
// flaky (e.g. the per-IP bucket tripping early).
export default async function globalSetup() {
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    lazyConnect: true,
  });

  const keys = await redis.keys('login:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }

  await redis.quit();
}
