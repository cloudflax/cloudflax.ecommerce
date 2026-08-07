import * as Sentry from '@sentry/nextjs';
import { env } from '@/lib/env';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 1,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
