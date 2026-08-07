'use client';

import { use, useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginAction, type LoginState } from './actions';

const initialState: LoginState = {};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = use(searchParams);
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 px-4">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
        <p className="text-muted-foreground text-sm">
          No tenés cuenta?{' '}
          <Link href="/register" className="underline underline-offset-4">
            Creá una
          </Link>
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
        {state.error && <p className="text-destructive text-sm">{state.error}</p>}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
          {state.fieldErrors?.email && (
            <p className="text-destructive text-sm">{state.fieldErrors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          {state.fieldErrors?.password && (
            <p className="text-destructive text-sm">{state.fieldErrors.password}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Ingresando...' : 'Ingresar'}
        </Button>
      </form>
    </div>
  );
}
