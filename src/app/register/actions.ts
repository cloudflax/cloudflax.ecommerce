'use server';

import { AuthError } from 'next-auth';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signIn } from '@/lib/auth';
import { registerSchema } from './schema';

export type RegisterState = {
  error?: string;
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
    await signIn('credentials', { email, password, redirectTo: '/account' });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: 'Cuenta creada. No se pudo iniciar sesión automáticamente, ingresá manualmente.',
      };
    }
    throw error;
  }

  return {};
}
