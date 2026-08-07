import { env } from '@/lib/env';

export function requireDevEnv() {
  if (env.NODE_ENV === 'production') {
    console.error('Refusing to run: NODE_ENV is production.');
    process.exit(1);
  }
}
