import { NextResponse } from 'next/server';
import { auth, ROLE_HOME } from '@/lib/auth';
import type { Role } from '@/generated/prisma/enums';

function requiredRoles(pathname: string): Role[] | null {
  if (pathname.startsWith('/admin')) return ['ADMIN', 'STAFF'];
  if (pathname.startsWith('/account')) return ['CUSTOMER'];
  if (pathname.startsWith('/delivery')) return ['DELIVERY'];
  return null;
}

// V12 — CSP with a per-request nonce, following the Next.js CSP guide:
// Next.js reads x-nonce (and the CSP header) from the request and stamps the
// nonce onto its inline scripts automatically. 'strict-dynamic' lets those
// trusted scripts load the rest; dev keeps 'unsafe-eval' for React debugging.
// Without this, /login and the dashboards are clickjackable and open to
// inline injection.
function cspHeaderValue(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = cspHeaderValue(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const roles = requiredRoles(pathname);
  const session = req.auth;
  // A session issued before role was added to the JWT (or any other unknown
  // role) has no valid home to send it to — treat it as unauthenticated.
  const home = session?.user ? ROLE_HOME[session.user.role] : undefined;

  let response: NextResponse;
  if (!roles) {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  } else if (!session?.user || !home) {
    const loginUrl = new URL('/login', req.nextUrl);
    loginUrl.searchParams.set('callbackUrl', pathname);
    response = NextResponse.redirect(loginUrl);
  } else if (!roles.includes(session.user.role)) {
    response = NextResponse.redirect(new URL(home, req.nextUrl));
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  response.headers.set('Content-Security-Policy', csp);
  return response;
});

export const config = {
  matcher: [
    '/admin/:path*',
    '/account/:path*',
    '/delivery/:path*',
    '/login',
    '/register',
    '/verify-email/:path*',
  ],
};
