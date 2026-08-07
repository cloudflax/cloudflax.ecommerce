import type { DefaultSession } from 'next-auth';
import type { Role } from '@/generated/prisma/enums';

declare module 'next-auth' {
  interface User {
    role: Role;
  }

  interface Session {
    user: {
      role: Role;
    } & DefaultSession['user'];
  }
}
