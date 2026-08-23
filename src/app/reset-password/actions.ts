'use server';

import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { getClientIp } from '@/lib/request-ip';
import { formatRetryAfter, rateLimit } from '@/lib/rate-limit';
import { resetPassword } from '@/lib/password-reset';
import { resetPasswordSchema } from './schema';

export type ResetPasswordState = {
  error?: string;
  fieldErrors?: Partial<Record<'password' | 'confirmPassword', string>>;
};

const INVALID_LINK_ERROR = 'Este link no es válido o ya expiró. Pedí uno nuevo.';

export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  // V10a — the token is only consumed here, on POST. The GET render checks it
  // read-only, so email scanners prefetching the link can't burn it.
  const token = formData.get('token');
  if (typeof token !== 'string' || !token) {
    return { error: INVALID_LINK_ERROR };
  }

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    const fieldErrors: ResetPasswordState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<ResetPasswordState['fieldErrors']>;
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  // Per-IP cap in front of the token check: the token is 64 hex chars, but the
  // submit endpoint stays a cheap target without this.
  const ip = await getClientIp();
  const { allowed, retryAfter } = await rateLimit(
    `reset:submit:ip:${ip}`,
    env.PASSWORD_RESET_RATE_LIMIT,
    60 * 60,
  );
  if (!allowed) {
    return {
      error: `Demasiados intentos. Esperá ${formatRetryAfter(retryAfter)} antes de volver a intentar.`,
    };
  }

  const ok = await resetPassword(token, parsed.data.password);
  if (!ok) {
    return { error: INVALID_LINK_ERROR };
  }

  redirect('/login?reset=1');
}
