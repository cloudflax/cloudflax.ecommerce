import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/email';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export async function issueVerificationEmail(email: string) {
  // Drop any previous token so only the most recently sent link is valid.
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });

  const token = randomBytes(32).toString('hex');
  await prisma.verificationToken.create({
    data: { identifier: email, token, expires: new Date(Date.now() + TOKEN_TTL_MS) },
  });

  await sendVerificationEmail(email, token);
}
