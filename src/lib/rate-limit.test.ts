import { beforeEach, describe, expect, it, vi } from 'vitest';

const pipeline = vi.fn();

vi.mock('@/lib/redis', () => ({ redis: { pipeline: () => pipeline() } }));

const { rateLimit, rateLimitMany } = await import('./rate-limit');

type Reply = [Error | null, unknown];

/** Minimal stand-in for an ioredis pipeline: records commands, replays replies. */
function fakePipeline(replies: Reply[] = []) {
  const commands: unknown[][] = [];
  const self = {
    commands,
    get length() {
      return commands.length;
    },
    incr(key: string) {
      commands.push(['incr', key]);
      return self;
    },
    ttl(key: string) {
      commands.push(['ttl', key]);
      return self;
    },
    expire(key: string, seconds: number) {
      commands.push(['expire', key, seconds]);
      return self;
    },
    exec: vi.fn(async () => replies),
  };
  return self;
}

/** INCR then TTL, the pair rateLimitMany queues per bucket. */
function bucketReplies(count: number, ttl: number): Reply[] {
  return [
    [null, count],
    [null, ttl],
  ];
}

beforeEach(() => {
  pipeline.mockReset();
});

describe('rateLimitMany', () => {
  it('allows a request under the limit', async () => {
    const counters = fakePipeline(bucketReplies(1, -1));
    const expirations = fakePipeline();
    pipeline.mockReturnValueOnce(counters).mockReturnValueOnce(expirations);

    const result = await rateLimitMany([{ key: 'login:a', limit: 3, windowSeconds: 60 }]);

    expect(result).toEqual({ allowed: true, retryAfter: 0 });
  });

  it('sets the TTL on a counter that has none, so it cannot lock forever', async () => {
    const counters = fakePipeline(bucketReplies(1, -1));
    const expirations = fakePipeline();
    pipeline.mockReturnValueOnce(counters).mockReturnValueOnce(expirations);

    await rateLimitMany([{ key: 'login:a', limit: 3, windowSeconds: 60 }]);

    expect(expirations.commands).toEqual([['expire', 'login:a', 60]]);
    expect(expirations.exec).toHaveBeenCalled();
  });

  it('leaves an existing TTL alone instead of extending the window on every hit', async () => {
    const counters = fakePipeline(bucketReplies(2, 42));
    const expirations = fakePipeline();
    pipeline.mockReturnValueOnce(counters).mockReturnValueOnce(expirations);

    await rateLimitMany([{ key: 'login:a', limit: 3, windowSeconds: 60 }]);

    expect(expirations.commands).toEqual([]);
    expect(expirations.exec).not.toHaveBeenCalled();
  });

  it('blocks over the limit and reports the remaining TTL', async () => {
    const counters = fakePipeline(bucketReplies(4, 25));
    const expirations = fakePipeline();
    pipeline.mockReturnValueOnce(counters).mockReturnValueOnce(expirations);

    const result = await rateLimitMany([{ key: 'login:a', limit: 3, windowSeconds: 60 }]);

    expect(result).toEqual({ allowed: false, retryAfter: 25 });
  });

  it('counts every bucket even when an earlier one already blocked', async () => {
    const counters = fakePipeline([...bucketReplies(9, 10), ...bucketReplies(1, -1)]);
    const expirations = fakePipeline();
    pipeline.mockReturnValueOnce(counters).mockReturnValueOnce(expirations);

    const result = await rateLimitMany([
      { key: 'login:a', limit: 3, windowSeconds: 60 },
      { key: 'login:ip:1.2.3.4', limit: 20, windowSeconds: 60 },
    ]);

    expect(counters.commands).toEqual([
      ['incr', 'login:a'],
      ['ttl', 'login:a'],
      ['incr', 'login:ip:1.2.3.4'],
      ['ttl', 'login:ip:1.2.3.4'],
    ]);
    expect(result.allowed).toBe(false);
  });

  it('reports the longest wait when several buckets are blocked', async () => {
    const counters = fakePipeline([...bucketReplies(9, 10), ...bucketReplies(99, 55)]);
    pipeline.mockReturnValueOnce(counters).mockReturnValueOnce(fakePipeline());

    const result = await rateLimitMany([
      { key: 'login:a', limit: 3, windowSeconds: 60 },
      { key: 'login:ip:1.2.3.4', limit: 20, windowSeconds: 60 },
    ]);

    expect(result.retryAfter).toBe(55);
  });

  it('short-circuits on an empty bucket list without touching Redis', async () => {
    const result = await rateLimitMany([]);

    expect(result).toEqual({ allowed: true, retryAfter: 0 });
    expect(pipeline).not.toHaveBeenCalled();
  });

  it('propagates a Redis failure so callers fail closed', async () => {
    const counters = fakePipeline([[new Error('READONLY'), null]]);
    pipeline.mockReturnValueOnce(counters).mockReturnValueOnce(fakePipeline());

    await expect(rateLimitMany([{ key: 'login:a', limit: 3, windowSeconds: 60 }])).rejects.toThrow(
      'READONLY',
    );
  });
});

describe('rateLimit', () => {
  it('wraps a single bucket', async () => {
    const counters = fakePipeline(bucketReplies(1, -1));
    pipeline.mockReturnValueOnce(counters).mockReturnValueOnce(fakePipeline());

    const result = await rateLimit('login:a', 3, 60);

    expect(counters.commands).toEqual([
      ['incr', 'login:a'],
      ['ttl', 'login:a'],
    ]);
    expect(result.allowed).toBe(true);
  });
});
