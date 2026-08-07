import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

export class InvalidLoginError extends CredentialsSignin {
  code = 'invalid-credentials';
}

export class RateLimitedError extends CredentialsSignin {
  code = 'rate-limited';
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  trustHost: true,
  pages: {
    signIn: '/login',
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

        const allowed = await rateLimit(`login:${email}`, 5, 60);
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
