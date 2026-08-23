import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { Role } from '@/generated/prisma/enums';

const VALID_ROLES = new Set<string>(Object.values(Role));

/**
 * Role for a session, from Redis cache or the database (V7).
 *
 * Returns null when the user no longer exists — the caller kills the session.
 * Redis failures fall through to the DB in both directions: unlike rate
 * limiting there is nothing to protect by failing closed here, the database is
 * the source of truth.
 */
export async function resolveUserRole(userId: string): Promise<Role | null> {
  const cacheKey = `user:role:${userId}`;

  try {
    const cached = await redis.get(cacheKey);
    // Validate: a value that isn't a Role (hand-written, stale deploy) would
    // poison the session — treat it as a miss.
    if (cached && VALID_ROLES.has(cached)) return cached as Role;
  } catch {
    // Cache down — fall through to the DB.
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return null;

  try {
    // Best-effort: TTL matches ROLE_REVALIDATE_SECONDS so the cache expires
    // exactly when the session would re-check the DB anyway.
    await redis.set(cacheKey, user.role, 'EX', env.ROLE_REVALIDATE_SECONDS);
  } catch {
    // Cache down — every request re-reads the DB until Redis is back.
  }

  return user.role;
}
