import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { redirect } from 'next/navigation';
import type { Role } from '@/generated/prisma/enums';
import bcrypt from 'bcryptjs';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

export class InvalidLoginError extends CredentialsSignin {
  code = 'invalid-credentials';
}

export class RateLimitedError extends CredentialsSignin {
  code = 'rate-limited';
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

        const allowed = await rateLimit(`login:${email}`, env.LOGIN_RATE_LIMIT, 60);
        if (!allowed) throw new RateLimitedError();

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.password) throw new InvalidLoginError();

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) throw new InvalidLoginError();

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
