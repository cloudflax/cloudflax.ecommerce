import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { redirect } from 'next/navigation';
import type { Role } from '@/generated/prisma/enums';
import bcrypt from 'bcryptjs';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { redis } from '@/lib/redis';

export class InvalidLoginError extends CredentialsSignin {
  code = 'invalid-credentials';
}

export class RateLimitedError extends CredentialsSignin {
  code = 'rate-limited';

  constructor(public retryAfter: number) {
    super();
  }
}

// Escalating lockout windows for the per-email lock (V2b): first block 60s,
// second 5min, third and beyond 30min. "Consecutive" means within
// LOCK_STREAK_TTL of the previous block; a successful login resets the streak.
const LOCK_WINDOWS_SECONDS = [60, 300, 1800];
const LOCK_STREAK_TTL_SECONDS = 60 * 60 * 24;

// Precomputed bcrypt hash of a throwaway string (V3). Compared when no user
// matches the email, so "unknown email" and "wrong password" cost the same
// ~100ms of bcrypt and response time can't be used to enumerate accounts.
const DUMMY_HASH = bcrypt.hashSync('cloudflax-timing-equalizer', 12);

export class EmailNotVerifiedError extends CredentialsSignin {
  code = 'email-not-verified';
}

export const ROLE_HOME: Record<Role, string> = {
  ADMIN: '/admin',
  STAFF: '/admin',
  DELIVERY: '/delivery',
  CUSTOMER: '/account',
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = user.role;
      return token;
    },
    session({ session, token }) {
      // JWT extends Record<string, unknown> and @auth/core/jwt isn't hoisted by
      // pnpm, so it can't be module-augmented from here — cast at the read site.
      if (session.user) session.user.role = token.role as Role;
      return session;
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) throw new InvalidLoginError();

        // Active escalated lock: don't even count attempts while it lasts.
        const activeLock = await redis.ttl(`login:lock:${email}`);
        if (activeLock > 0) throw new RateLimitedError(activeLock);

        const { allowed } = await rateLimit(`login:${email}`, env.LOGIN_RATE_LIMIT, 60);
        if (!allowed) {
          // Each consecutive block doubles down: 60s, then 5min, then 30min cap.
          const streak = await redis.incr(`login:locks:${email}`);
          if (streak === 1) await redis.expire(`login:locks:${email}`, LOCK_STREAK_TTL_SECONDS);
          const windowSeconds =
            LOCK_WINDOWS_SECONDS[Math.min(streak - 1, LOCK_WINDOWS_SECONDS.length - 1)];
          await redis.set(`login:lock:${email}`, streak, 'EX', windowSeconds);
          throw new RateLimitedError(windowSeconds);
        }

        const user = await prisma.user.findUnique({ where: { email } });
        const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
        if (!user || !valid) throw new InvalidLoginError();

        if (!user.emailVerified) throw new EmailNotVerifiedError();

        // Success breaks the block streak — a legit owner logging in wipes the
        // escalation an attacker built against their account.
        await redis.del(`login:locks:${email}`, `login:lock:${email}`);

        return user;
      },
    }),
  ],
});

// Defense in depth alongside src/proxy.ts: layouts call this directly since
// Next's own docs warn against relying on Proxy alone for authorization
// (a matcher change or refactor can silently drop coverage).
export async function requireRole(...roles: Role[]) {
  const session = await auth();
  if (!session?.user || !roles.includes(session.user.role)) {
    redirect('/login');
  }
  return session;
}
