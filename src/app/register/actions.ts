'use server';

import * as Sentry from '@sentry/nextjs';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { issueVerificationEmail } from '@/lib/verification-token';
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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { fieldErrors: { email: 'Ya existe una cuenta con este email' } };
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
