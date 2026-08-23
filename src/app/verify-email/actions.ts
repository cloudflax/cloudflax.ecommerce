'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';

async function verify(token: string): Promise<boolean> {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record) return false;

  await prisma.verificationToken.delete({ where: { token } });
  if (record.expires < new Date()) return false;

  try {
    await prisma.user.update({
      where: { email: record.identifier },
      data: { emailVerified: new Date() },
    });
  } catch (error) {
    // V10b — the account was deleted after the token was issued: the link
    // can't work, report it as invalid instead of a 500.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return false;
    }
    throw error;
  }

  return true;
}

/**
 * V10a — the mutation happens here, on POST. Previously it ran during the GET
 * render, and email scanners (Outlook/Gmail prefetching links) consumed the
 * token before the real user ever clicked.
 */
export async function verifyEmailAction(formData: FormData): Promise<void> {
  const token = formData.get('token');
  if (typeof token !== 'string' || !token) redirect('/verify-email/expired');

  const ok = await verify(token);
  redirect(ok ? '/verify-email/confirmed' : '/verify-email/expired');
}
