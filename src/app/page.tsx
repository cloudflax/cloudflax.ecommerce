import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="mx-auto flex min-h-svh max-w-sm flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Cloudflax</h1>
        <p className="text-muted-foreground text-sm">Tu tienda online.</p>
      </div>

      <div className="flex w-full flex-col gap-2">
        <Button render={<Link href="/login" />} nativeButton={false}>
          Iniciar sesión
        </Button>
        <Button render={<Link href="/register" />} nativeButton={false} variant="outline">
          Crear cuenta
        </Button>
      </div>
    </div>
  );
}
