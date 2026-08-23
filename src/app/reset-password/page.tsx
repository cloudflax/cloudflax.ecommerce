import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth, ROLE_HOME } from '@/lib/auth';
import { isValidResetToken } from '@/lib/password-reset';
import { ResetPasswordForm } from './reset-password-form';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const session = await auth();
  const home = session?.user ? ROLE_HOME[session.user.role] : undefined;
  if (home) redirect(home);

  const { token } = await searchParams;
  const rawToken = typeof token === 'string' && token !== '' ? token : null;
  // Read-only check — the token is consumed on POST, never during render (V10a).
  const valid = rawToken ? await isValidResetToken(rawToken) : false;

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md text-xs font-semibold">
            C
          </div>
          Cloudflax
        </Link>

        {valid && rawToken ? (
          <ResetPasswordForm token={rawToken} />
        ) : (
          <Card className="[--card-spacing:--spacing(6)]">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Link inválido</CardTitle>
              <CardDescription>
                Este link no es válido o ya expiró. Pedí uno nuevo para continuar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/forgot-password" className={buttonVariants({ className: 'w-full' })}>
                Pedir un link nuevo
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
