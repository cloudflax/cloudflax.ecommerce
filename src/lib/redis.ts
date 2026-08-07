import Redis from 'ioredis';
import { env } from '@/lib/env';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

// lazyConnect: defers the TCP connection until the first command instead of
// opening it at import time — otherwise `next build`/`pnpm typecheck` would
// hang or throw whenever Redis isn't running (e.g. docker-compose is down).
export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    lazyConnect: true,
  });

redis.on('error', (error) => {
  console.error('Redis connection error', error);
});

if (env.NODE_ENV !== 'production') globalForRedis.redis = redis;
