import Link from 'next/link';
import { prisma } from '@/lib/prisma';

async function verify(token: string): Promise<boolean> {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record) return false;

  await prisma.verificationToken.delete({ where: { token } });
  if (record.expires < new Date()) return false;

  await prisma.user.update({
    where: { email: record.identifier },
    data: { emailVerified: new Date() },
  });
  return true;
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const ok = token ? await verify(token) : false;

  return (
    <div className="mx-auto flex min-h-svh max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">
        {ok ? 'Email verificado' : 'Link inválido o vencido'}
      </h1>
      <p className="text-muted-foreground text-sm">
        {ok ? 'Ya podés iniciar sesión.' : 'Pedí un nuevo email de verificación desde el login.'}
      </p>
      <Link href="/login" className="underline underline-offset-4">
        Ir a iniciar sesión
      </Link>
    </div>
  );
}
