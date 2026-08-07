import { NextResponse } from 'next/server';
import { auth, ROLE_HOME } from '@/lib/auth';
import type { Role } from '@/generated/prisma/enums';

function requiredRoles(pathname: string): Role[] | null {
  if (pathname.startsWith('/admin')) return ['ADMIN', 'STAFF'];
  if (pathname.startsWith('/account')) return ['CUSTOMER'];
  if (pathname.startsWith('/delivery')) return ['DELIVERY'];
  return null;
}

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const roles = requiredRoles(pathname);
  if (!roles) return NextResponse.next();

  const session = req.auth;
  // A session issued before role was added to the JWT (or any other unknown
  // role) has no valid home to send it to — treat it as unauthenticated.
  const home = session?.user ? ROLE_HOME[session.user.role] : undefined;
  if (!session?.user || !home) {
    const loginUrl = new URL('/login', req.nextUrl);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!roles.includes(session.user.role)) {
    return NextResponse.redirect(new URL(home, req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/admin/:path*', '/account/:path*', '/delivery/:path*'],
};
