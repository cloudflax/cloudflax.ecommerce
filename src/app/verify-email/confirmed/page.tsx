import Link from 'next/link';

export default function VerifiedPage() {
  return (
    <div className="mx-auto flex min-h-svh max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Email verificado</h1>
      <p className="text-muted-foreground text-sm">Ya podés iniciar sesión.</p>
      <Link href="/login" className="underline underline-offset-4">
        Ir a iniciar sesión
      </Link>
    </div>
  );
}
