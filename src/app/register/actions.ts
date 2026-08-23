'use server';

import * as Sentry from '@sentry/nextjs';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sendAccountExistsNotice } from '@/lib/email';
import { issueVerificationEmail } from '@/lib/verification-token';
import { env } from '@/lib/env';
import { getClientIp } from '@/lib/request-ip';
import { formatRetryAfter, rateLimit } from '@/lib/rate-limit';
import { registerSchema } from './schema';

export type RegisterState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<
    Record<'name' | 'email' | 'phone' | 'password' | 'confirmPassword' | 'terms', string>
  >;
};

export async function registerAction(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    terms: formData.get('terms') === 'on',
  });

  if (!parsed.success) {
    const fieldErrors: RegisterState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<RegisterState['fieldErrors']>;
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  const { name, email, phone, password } = parsed.data;

  // V6a — per-IP limit on signups: without it, mass account creation is free
  // and each one fires its own verification email (both an abuse vector and a
  // Resend quota burn). Only well-formed submissions count: malformed ones
  // return before this line, so an attacker can't exhaust the bucket of a
  // shared office/NAT IP by sending garbage.
  const ip = await getClientIp();
  const ipLimit = await rateLimit(`register:ip:${ip}`, env.REGISTER_RATE_LIMIT, 60 * 60);
  if (!ipLimit.allowed) {
    return {
      error: `Demasiados registros desde tu red. Esperá ${formatRetryAfter(ipLimit.retryAfter)} antes de volver a intentar.`,
    };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // V6b — 'Ya existe una cuenta con este email' would confirm which emails
    // are registered. Show the same message a successful signup shows, and
    // tell the address owner someone tried instead.
    try {
      await sendAccountExistsNotice(email);
    } catch (error) {
      Sentry.captureException(error);
    }

    return { success: 'Cuenta creada. Revisá tu email para verificarla antes de iniciar sesión.' };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name,
      email,
      phone,
      password: hashedPassword,
      termsAcceptedAt: new Date(),
    },
  });

  try {
    await issueVerificationEmail(email);
  } catch (error) {
    // The account is already created and usable via "reenviar" later — a
    // delivery failure shouldn't block registration, but ops needs to know.
    Sentry.captureException(error);
  }

  return { success: 'Cuenta creada. Revisá tu email para verificarla antes de iniciar sesión.' };
}
