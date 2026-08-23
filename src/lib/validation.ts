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
