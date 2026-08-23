'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { forgotPasswordAction, type ForgotPasswordState } from './actions';

const initialState: ForgotPasswordState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initialState);

  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Recuperá tu contraseña</CardTitle>
        <CardDescription>Ingresá tu email y te enviamos un link para restablecerla</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          <FieldGroup className="gap-7">
            <FieldError errors={state.error ? [{ message: state.error }] : undefined} />

            <Field className="gap-3" data-invalid={!!state.fieldErrors?.email}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" name="email" type="email" autoComplete="email" required />
              <FieldError
                errors={
                  state.fieldErrors?.email ? [{ message: state.fieldErrors.email }] : undefined
                }
              />
            </Field>

            <Field className="gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? 'Enviando...' : 'Enviar link de recuperación'}
              </Button>
              <FieldDescription className="text-center">
                Volver a <Link href="/login">iniciar sesión</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>

        {state.info && (
          <p className="text-muted-foreground mt-4 text-center text-sm">{state.info}</p>
        )}
      </CardContent>
    </Card>
  );
}
