'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { resetPasswordAction, type ResetPasswordState } from './actions';

const initialState: ResetPasswordState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Elegí una contraseña nueva</CardTitle>
        <CardDescription>Mínimo 8 caracteres, con mayúscula, número y símbolo</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          <input type="hidden" name="token" value={token} />
          <FieldGroup className="gap-7">
            <FieldError errors={state.error ? [{ message: state.error }] : undefined} />

            <Field className="gap-3" data-invalid={!!state.fieldErrors?.password}>
              <FieldLabel htmlFor="password">Contraseña nueva</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
              <FieldError
                errors={
                  state.fieldErrors?.password
                    ? [{ message: state.fieldErrors.password }]
                    : undefined
                }
              />
            </Field>

            <Field className="gap-3" data-invalid={!!state.fieldErrors?.confirmPassword}>
              <FieldLabel htmlFor="confirmPassword">Repetí la contraseña</FieldLabel>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
              />
              <FieldError
                errors={
                  state.fieldErrors?.confirmPassword
                    ? [{ message: state.fieldErrors.confirmPassword }]
                    : undefined
                }
              />
            </Field>

            <Field className="gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? 'Guardando...' : 'Guardar contraseña'}
              </Button>
              <FieldDescription className="text-center">
                El link se invalida apenas guardás la contraseña.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
