import { beforeEach, describe, expect, it, vi } from 'vitest';

// session-role.ts imports env directly, and createEnv validates at import time
// — no .env vars exist inside vitest, so mock the module itself.
vi.mock('@/lib/env', () => ({ env: { ROLE_REVALIDATE_SECONDS: 300 } }));

const redisGet = vi.fn();
const redisSet = vi.fn();

vi.mock('@/lib/redis', () => ({
  redis: {
    get: (...args: unknown[]) => redisGet(...args),
    set: (...args: unknown[]) => redisSet(...args),
  },
}));

const prismaFindUnique = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: (...args: unknown[]) => prismaFindUnique(...args) } },
}));

const { resolveUserRole } = await import('./session-role');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveUserRole', () => {
  it('returns a valid cached role without touching the database', async () => {
    redisGet.mockResolvedValue('DELIVERY');

    await expect(resolveUserRole('user-1')).resolves.toBe('DELIVERY');
    expect(prismaFindUnique).not.toHaveBeenCalled();
    expect(redisSet).not.toHaveBeenCalled();
  });

  it('treats a corrupted cache value as a miss', async () => {
    redisGet.mockResolvedValue('SUPERUSER');
    prismaFindUnique.mockResolvedValue({ role: 'CUSTOMER' });

    await expect(resolveUserRole('user-1')).resolves.toBe('CUSTOMER');
    expect(prismaFindUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { role: true },
    });
  });

  it('reads the database and caches on a miss', async () => {
    redisGet.mockResolvedValue(null);
    prismaFindUnique.mockResolvedValue({ role: 'ADMIN' });

    await expect(resolveUserRole('user-1')).resolves.toBe('ADMIN');
    expect(redisSet).toHaveBeenCalledWith('user:role:user-1', 'ADMIN', 'EX', expect.any(Number));
  });

  it('returns null when the user no longer exists', async () => {
    redisGet.mockResolvedValue(null);
    prismaFindUnique.mockResolvedValue(null);

    await expect(resolveUserRole('user-1')).resolves.toBeNull();
  });

  it('falls back to the database when the cache read throws', async () => {
    redisGet.mockRejectedValue(new Error('connection refused'));
    prismaFindUnique.mockResolvedValue({ role: 'STAFF' });

    await expect(resolveUserRole('user-1')).resolves.toBe('STAFF');
  });

  it('survives a failing cache write', async () => {
    redisGet.mockResolvedValue(null);
    prismaFindUnique.mockResolvedValue({ role: 'STAFF' });
    redisSet.mockRejectedValue(new Error('connection refused'));

    await expect(resolveUserRole('user-1')).resolves.toBe('STAFF');
  });
});
