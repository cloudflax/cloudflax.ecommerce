import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { verifyEmailAction } from './actions';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect('/verify-email/expired');

  // The token is consumed on POST, not while rendering this page — GET stays
  // side-effect free so link scanners can't burn it (V10a).
  return (
    <div className="mx-auto flex min-h-svh max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Verificá tu email</h1>
      <p className="text-muted-foreground text-sm">Confirmá tu dirección para activar la cuenta.</p>
      <form action={verifyEmailAction}>
        <input type="hidden" name="token" value={token} />
        <Button type="submit">Confirmar email</Button>
      </form>
    </div>
  );
}
