import { Resend } from 'resend';
import { env } from '@/lib/env';

export const resend = new Resend(env.RESEND_API_KEY);

export async function sendVerificationEmail(to: string, token: string) {
  const verifyUrl = new URL('/verify-email', env.NEXTAUTH_URL);
  verifyUrl.searchParams.set('token', token);

  await send({
    to,
    subject: 'Verificá tu email',
    html: `<p>Confirmá tu cuenta haciendo clic en el siguiente link:</p><p><a href="${verifyUrl.toString()}">${verifyUrl.toString()}</a></p><p>Este link vence en 24 horas.</p>`,
  });
}

/**
 * V6b — when someone tries to sign up with an address that already has an
 * account, the form shows the same success message as a real signup (so
 * registration can't enumerate accounts) and the address owner gets this.
 */
export async function sendAccountExistsNotice(to: string) {
  const loginUrl = new URL('/login', env.NEXTAUTH_URL);

  await send({
    to,
    subject: 'Alguien intentó crear una cuenta con tu email',
    html: `<p>Alguien intentó registrarse con tu dirección de email. Si no fuiste vos, no hace falta hacer nada: tu cuenta ya existía y no fue modificada.</p><p>Si fuiste vos, podés <a href="${loginUrl.toString()}">iniciar sesión acá</a>.</p>`,
  });
}

async function send({ to, subject, html }: { to: string; subject: string; html: string }) {
  // resend.emails.send() returns { data, error } instead of throwing —
  // without this check a failed send looks identical to a successful one.
  const { error } = await resend.emails.send({ from: env.EMAIL_FROM, to, subject, html });

  if (error) {
    throw new Error(`Resend error: ${error.name} - ${error.message}`);
  }
}
