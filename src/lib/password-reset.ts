import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';

const TOKEN_TTL_MS = 60 * 60 * 1000;

/** sha256 of the raw token — only this hash ever touches the database. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function issuePasswordResetToken(email: string): Promise<void> {
  // Drop any previous token so only the most recently sent link is valid.
  await prisma.passwordResetToken.deleteMany({ where: { identifier: email } });

  const token = randomBytes(32).toString('hex');
  await prisma.passwordResetToken.create({
    data: {
      identifier: email,
      tokenHash: hashToken(token),
      expires: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  await sendPasswordResetEmail(email, token);
}

/**
 * Read-only check for the GET render of /reset-password. Never deletes: email
 * scanners prefetch links, so consumption must happen only on POST (V10a).
 */
export async function isValidResetToken(token: string): Promise<boolean> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { expires: true },
  });
  return !!record && record.expires > new Date();
}

/**
 * Consumes the token and sets the new password in one transaction: the token
 * only dies when the password actually changed, and two parallel submits can't
 * both win the same link (the second deleteMany finds nothing).
 *
 * Returns false for an invalid, expired, or already-used token, and when the
 * account was deleted after the token was issued — the link can't work then.
 */
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const tokenHash = hashToken(token);

  try {
    return await prisma.$transaction(async (tx) => {
      const record = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
      if (!record) return false;

      const deleted = await tx.passwordResetToken.deleteMany({
        where: { tokenHash, expires: { gt: new Date() } },
      });
      if (deleted.count === 0) return false;

      const password = await bcrypt.hash(newPassword, 12);
      await tx.user.update({
        where: { email: record.identifier },
        // passwordChangedAt stamps every reset — the jwt callback compares it
        // against the session token and kills sessions that predate the change.
        data: { password, passwordChangedAt: new Date() },
      });

      return true;
    });
  } catch (error) {
    // P2025 — the account was deleted between issue and reset: the link can't
    // work, report it as invalid instead of a 500.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return false;
    }
    throw error;
  }
}
