'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { registerAction, type RegisterState } from './actions';

const initialState: RegisterState = {};

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <div className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 px-4">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Crear cuenta</h1>
        <p className="text-muted-foreground text-sm">
          Ya tenés cuenta?{' '}
          <Link href="/login" className="underline underline-offset-4">
            Iniciá sesión
          </Link>
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        {state.error && <p className="text-destructive text-sm">{state.error}</p>}

        <div className="space-y-2">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" autoComplete="name" required />
          {state.fieldErrors?.name && (
            <p className="text-destructive text-sm">{state.fieldErrors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
          {state.fieldErrors?.email && (
            <p className="text-destructive text-sm">{state.fieldErrors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" required />
          {state.fieldErrors?.phone && (
            <p className="text-destructive text-sm">{state.fieldErrors.phone}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
          {state.fieldErrors?.password && (
            <p className="text-destructive text-sm">{state.fieldErrors.password}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
          {state.fieldErrors?.confirmPassword && (
            <p className="text-destructive text-sm">{state.fieldErrors.confirmPassword}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox id="terms" name="terms" required />
            <Label htmlFor="terms" className="font-normal">
              Acepto los términos y condiciones
            </Label>
          </div>
          {state.fieldErrors?.terms && (
            <p className="text-destructive text-sm">{state.fieldErrors.terms}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Creando cuenta...' : 'Crear cuenta'}
        </Button>
      </form>
    </div>
  );
}
