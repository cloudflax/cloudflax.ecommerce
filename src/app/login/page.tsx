import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, ROLE_HOME } from '@/lib/auth';
import { FieldDescription } from '@/components/ui/field';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; reset?: string }>;
}) {
  const session = await auth();
  const home = session?.user ? ROLE_HOME[session.user.role] : undefined;
  // An active session means someone could log another account in on top of it
  // without a logout (V4). Send them home instead. A session whose role has no
  // ROLE_HOME entry (e.g. issued before role joined the JWT) falls through to
  // the form — redirecting to undefined is worse than showing the login.
  if (home) redirect(home);

  const { callbackUrl, reset } = await searchParams;

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md text-xs font-semibold">
            C
          </div>
          Cloudflax
        </Link>

        <div className="flex flex-col gap-6">
          {reset === '1' && (
            <FieldDescription className="px-6 text-center">
              Contraseña actualizada. Ingresá con tu nueva contraseña.
            </FieldDescription>
          )}

          <LoginForm callbackUrl={callbackUrl} />

          <FieldDescription className="px-6 text-center">
            Al continuar, aceptás nuestros <Link href="#">Términos del servicio</Link> y nuestra{' '}
            <Link href="#">Política de privacidad</Link>.
          </FieldDescription>
        </div>
      </div>
    </div>
  );
}
