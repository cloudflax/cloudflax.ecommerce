'use server';

import { AuthError } from 'next-auth';
import { signIn, InvalidLoginError, RateLimitedError } from '@/lib/auth';
import { loginSchema } from './schema';

export type LoginState = {
  error?: string;
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

  try {
    await signIn('credentials', { email, password, redirectTo: '/' });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return { error: 'Demasiados intentos. Esperá un minuto antes de volver a intentar.' };
    }
    if (error instanceof InvalidLoginError) {
      return { error: 'Email o contraseña incorrectos.' };
    }
    if (error instanceof AuthError) {
      return { error: 'No se pudo iniciar sesión. Intentá de nuevo.' };
    }
    throw error;
  }

  return {};
}
