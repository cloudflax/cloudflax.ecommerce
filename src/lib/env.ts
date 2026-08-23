import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    NEXTAUTH_URL: z.url(),
    NEXTAUTH_SECRET: z.string().min(1),
    LOGIN_RATE_LIMIT: z.coerce.number().int().positive().default(3),
    LOGIN_IP_RATE_LIMIT: z.coerce.number().int().positive().default(20),
    REGISTER_RATE_LIMIT: z.coerce.number().int().positive().default(5),
    RESEND_RATE_LIMIT: z.coerce.number().int().positive().default(1),
    ROLE_REVALIDATE_SECONDS: z.coerce.number().int().positive().default(300),
    TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
    RESEND_API_KEY: z.string().min(1),
    EMAIL_FROM: z.string().min(1).default('onboarding@resend.dev'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  },
  client: {
    NEXT_PUBLIC_SENTRY_DSN: z.url(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
});
