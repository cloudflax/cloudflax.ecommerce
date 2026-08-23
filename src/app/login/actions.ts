'use server';

import { redirect } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { AuthError } from 'next-auth';
import {
  signIn,
  InvalidLoginError,
  RateLimitedError,
  EmailNotVerifiedError,
  ROLE_HOME,
} from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { issueVerificationEmail } from '@/lib/verification-token';
import { env } from '@/lib/env';
import { getClientIp } from '@/lib/request-ip';
import { formatRetryAfter, rateLimit, rateLimitMany } from '@/lib/rate-limit';
import { isSafeRedirect } from '@/lib/safe-redirect';
import { loginSchema } from './schema';

export type LoginState = {
  error?: string;
  info?: string;
  unverifiedEmail?: string;
  fieldErrors?: Partial<Record<'email' | 'password', string>>;
};

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    const fieldErrors: LoginState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<LoginState['fieldErrors']>;
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  const { email, password } = parsed.data;

  // V2a — per-IP limit in front of signIn: without it, `login:${email}` buckets
  // do nothing against password spraying across many accounts.
  const ip = await getClientIp();
  const ipLimit = await rateLimit(`login:ip:${ip}`, env.LOGIN_IP_RATE_LIMIT, 60);
  if (!ipLimit.allowed) {
    return {
      error: `Demasiados intentos desde tu red. Esperá ${formatRetryAfter(ipLimit.retryAfter)} antes de volver a intentar.`,
    };
  }

  try {
    await signIn('credentials', { email, password, redirect: false });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return {
        error: `Demasiados intentos. Esperá ${formatRetryAfter(error.retryAfter)} antes de volver a intentar.`,
      };
    }
    if (error instanceof InvalidLoginError) {
      return { error: 'Email o contraseña incorrectos.' };
    }
    if (error instanceof EmailNotVerifiedError) {
      return {
        error: 'Todavía no verificaste tu email.',
        unverifiedEmail: email,
      };
    }
    if (error instanceof AuthError) {
      return { error: 'No se pudo iniciar sesión. Intentá de nuevo.' };
    }
    throw error;
  }

  const callbackUrl = formData.get('callbackUrl') as string | null;
  if (isSafeRedirect(callbackUrl)) redirect(callbackUrl);

  const user = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  redirect(ROLE_HOME[user!.role]);
}

export async function resendVerificationAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get('email');
  if (typeof email !== 'string' || !email) {
    return { error: 'Falta el email.' };
  }

  // V5 — no auth, no token required: in a loop this floods the victim's inbox
  // and burns the Resend quota. Both buckets always count (rateLimitMany
  // keeps them in sync), so an attacker can't reset the IP counter by
  // targeting a fresh email each time.
  const ip = await getClientIp();
  const { allowed, retryAfter } = await rateLimitMany([
    { key: `resend:${email}`, limit: env.RESEND_RATE_LIMIT, windowSeconds: 5 * 60 },
    { key: `resend:ip:${ip}`, limit: env.RESEND_RATE_LIMIT, windowSeconds: 5 * 60 },
  ]);
  if (!allowed) {
    return {
      error: `Ya enviamos un email recientemente. Esperá ${formatRetryAfter(retryAfter)} antes de pedir otro.`,
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.emailVerified) {
    try {
      await issueVerificationEmail(email);
    } catch (error) {
      Sentry.captureException(error);
    }
  }

  // Same message whether or not the account exists/is already verified, so
  // this can't be used to probe which emails are registered.
  return { info: 'Si tu cuenta existe y no está verificada, te reenviamos el email.' };
}
