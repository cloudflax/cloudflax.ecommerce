import { z } from 'zod';

/**
 * Shared so login and registration normalize identically. If they ever diverge,
 * an account created as `Jose@x.com` becomes unreachable from a login typed as
 * `jose@x.com`: Postgres `@unique` is case-sensitive, so those are two rows.
 *
 * Normalization runs before validation — `z.email()` rejects surrounding
 * whitespace, so trimming afterwards would never get the chance to fix it.
 */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Email inválido'));

/** Strength rules shared by registration and password reset. */
export const passwordSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Debe incluir una mayúscula')
  .regex(/[0-9]/, 'Debe incluir un número')
  .regex(/[^A-Za-z0-9]/, 'Debe incluir un símbolo');
