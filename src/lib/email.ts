import { Resend } from 'resend';
import { env } from '@/lib/env';

export const resend = new Resend(env.RESEND_API_KEY);

export async function sendVerificationEmail(to: string, token: string) {
  const verifyUrl = new URL('/verify-email', env.NEXTAUTH_URL);
  verifyUrl.searchParams.set('token', token);

  // resend.emails.send() returns { data, error } instead of throwing —
  // without this check a failed send looks identical to a successful one.
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'Verificá tu email',
    html: `<p>Confirmá tu cuenta haciendo clic en el siguiente link:</p><p><a href="${verifyUrl.toString()}">${verifyUrl.toString()}</a></p><p>Este link vence en 24 horas.</p>`,
  });

  if (error) {
    throw new Error(`Resend error: ${error.name} - ${error.message}`);
  }
}
