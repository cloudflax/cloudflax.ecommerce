import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { Prisma } from '@/generated/prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const passwordResetToken = {
  deleteMany: vi.fn(),
  create: vi.fn(),
  findUnique: vi.fn(),
};
const userUpdate = vi.fn();

const prismaMock = {
  passwordResetToken,
  user: { update: userUpdate },
  $transaction: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const sendPasswordResetEmail = vi.fn();

vi.mock('@/lib/email', () => ({ sendPasswordResetEmail }));

const { hashToken, issuePasswordResetToken, isValidResetToken, resetPassword } =
  await import('./password-reset');

beforeEach(() => {
  vi.clearAllMocks();
  // Stand-in for an interactive transaction: the callback receives the same
  // mocked prisma object.
  prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) =>
    callback(prismaMock),
  );
});

function futureDate(offsetMs: number): Date {
  return new Date(Date.now() + offsetMs);
}

/** Error instance that passes `instanceof PrismaClientKnownRequestError`. */
function p2025Error(): Prisma.PrismaClientKnownRequestError {
  const error = Object.create(Prisma.PrismaClientKnownRequestError.prototype);
  error.code = 'P2025';
  return error;
}

describe('hashToken', () => {
  it('is a sha256 of the raw token', () => {
    expect(hashToken('abc')).toBe(createHash('sha256').update('abc').digest('hex'));
  });

  it('never returns the raw token', () => {
    const raw = 'a'.repeat(64);
    expect(hashToken(raw)).not.toBe(raw);
  });
});

describe('issuePasswordResetToken', () => {
  it('drops previous tokens for the email before creating the new one', async () => {
    passwordResetToken.create.mockResolvedValue({});
    sendPasswordResetEmail.mockResolvedValue(undefined);

    await issuePasswordResetToken('a@cloudflax.test');

    expect(passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: 'a@cloudflax.test' },
    });
    expect(passwordResetToken.create).toHaveBeenCalledTimes(1);
  });

  it('stores only a hash and emails the raw 64-hex token', async () => {
    passwordResetToken.create.mockResolvedValue({});
    sendPasswordResetEmail.mockResolvedValue(undefined);

    await issuePasswordResetToken('a@cloudflax.test');

    const raw = sendPasswordResetEmail.mock.calls[0][1];
    expect(raw).toMatch(/^[0-9a-f]{64}$/);

    const { data } = passwordResetToken.create.mock.calls[0][0];
    expect(data.tokenHash).toBe(hashToken(raw));
    expect(data.identifier).toBe('a@cloudflax.test');
    expect(data.expires.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('isValidResetToken', () => {
  it('is true while the token exists and has not expired', async () => {
    passwordResetToken.findUnique.mockResolvedValue({ expires: futureDate(60_000) });
    await expect(isValidResetToken('token')).resolves.toBe(true);
  });

  it('is false once expired', async () => {
    passwordResetToken.findUnique.mockResolvedValue({ expires: futureDate(-60_000) });
    await expect(isValidResetToken('token')).resolves.toBe(false);
  });

  it('is false when the token does not exist', async () => {
    passwordResetToken.findUnique.mockResolvedValue(null);
    await expect(isValidResetToken('token')).resolves.toBe(false);
  });
});

describe('resetPassword', () => {
  const NEW_PASSWORD = 'Nueva1234!';

  it('consumes the token and stores a bcrypt hash plus the change stamp', async () => {
    passwordResetToken.findUnique.mockResolvedValue({
      identifier: 'a@cloudflax.test',
      expires: futureDate(60_000),
    });
    passwordResetToken.deleteMany.mockResolvedValue({ count: 1 });
    userUpdate.mockResolvedValue({});

    await expect(resetPassword('token', NEW_PASSWORD)).resolves.toBe(true);

    expect(passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: hashToken('token'), expires: { gt: expect.any(Date) } },
    });

    const { data } = userUpdate.mock.calls[0][0];
    expect(data.password).not.toBe(NEW_PASSWORD);
    await expect(bcrypt.compare(NEW_PASSWORD, data.password)).resolves.toBe(true);
    expect(data.passwordChangedAt).toBeInstanceOf(Date);
  });

  it('rejects an expired token without touching the user', async () => {
    passwordResetToken.findUnique.mockResolvedValue({
      identifier: 'a@cloudflax.test',
      expires: futureDate(-60_000),
    });
    passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });

    await expect(resetPassword('token', NEW_PASSWORD)).resolves.toBe(false);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('rejects an unknown token', async () => {
    passwordResetToken.findUnique.mockResolvedValue(null);

    await expect(resetPassword('token', NEW_PASSWORD)).resolves.toBe(false);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('a second submit of the same link fails — the token is single-use', async () => {
    // The first submit consumed the token, so findUnique now finds nothing.
    passwordResetToken.findUnique.mockResolvedValue(null);

    await expect(resetPassword('token', NEW_PASSWORD)).resolves.toBe(false);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('returns false (not 500) when the account was deleted after the token was issued', async () => {
    passwordResetToken.findUnique.mockResolvedValue({
      identifier: 'gone@cloudflax.test',
      expires: futureDate(60_000),
    });
    passwordResetToken.deleteMany.mockResolvedValue({ count: 1 });
    userUpdate.mockRejectedValue(p2025Error());

    await expect(resetPassword('token', NEW_PASSWORD)).resolves.toBe(false);
  });
});
