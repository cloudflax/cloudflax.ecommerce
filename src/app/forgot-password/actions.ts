'use server';

import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { getClientIp } from '@/lib/request-ip';
import { formatRetryAfter, rateLimitMany } from '@/lib/rate-limit';
import { issuePasswordResetToken } from '@/lib/password-reset';
import { forgotPasswordSchema } from './schema';

export type ForgotPasswordState = {
  info?: string;
  error?: string;
  fieldErrors?: Partial<Record<'email', string>>;
};

export async function forgotPasswordAction(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get('email'),
  });

  if (!parsed.success) {
    const fieldErrors: ForgotPasswordState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<ForgotPasswordState['fieldErrors']>;
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  const { email } = parsed.data;

  // Both buckets always count (rateLimitMany keeps them in sync), so an
  // attacker can't reset the IP counter by rotating emails.
  const ip = await getClientIp();
  const { allowed, retryAfter } = await rateLimitMany([
    { key: `reset:req:${email}`, limit: env.PASSWORD_RESET_RATE_LIMIT, windowSeconds: 60 * 60 },
    { key: `reset:req:ip:${ip}`, limit: env.PASSWORD_RESET_RATE_LIMIT, windowSeconds: 60 * 60 },
  ]);
  if (!allowed) {
    return {
      error: `Demasiadas solicitudes. Esperá ${formatRetryAfter(retryAfter)} antes de pedir otro link.`,
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    try {
      await issuePasswordResetToken(email);
    } catch (error) {
      // Email failed to send — report it, but keep the anti-enumeration
      // response identical.
      Sentry.captureException(error);
    }
  }

  // Same message whether or not the account exists, so this can't be used to
  // probe which emails are registered (V6b pattern).
  return { info: 'Si existe una cuenta para ese email, te enviamos un link de recuperación.' };
}
