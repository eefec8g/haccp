import { NextResponse } from 'next/server';
import type { UserRole } from '@prisma/client';
import { auth } from '@/lib/auth';
import { POST_LOGIN_REDIRECT } from '@/lib/constants/auth';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];
const ADMIN_PATHS = ['/admin'];

const FALLBACK_REDIRECT = POST_LOGIN_REDIRECT.SALARIE;

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

function redirectTargetFor(role: UserRole | undefined): string {
  if (!role) {
    return FALLBACK_REDIRECT;
  }
  return POST_LOGIN_REDIRECT[role];
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Laisser passer les routes NextAuth internes.
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const isAuthenticated = !!req.auth;
  const role = req.auth?.user?.role as UserRole | undefined;
  const isPublic = isPublicPath(pathname);

  if (!isAuthenticated && !isPublic) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isPublic) {
    const target = new URL(redirectTargetFor(role), req.nextUrl.origin);
    return NextResponse.redirect(target);
  }

  if (isAdminPath(pathname) && role !== 'ADMIN') {
    return NextResponse.redirect(
      new URL(redirectTargetFor(role), req.nextUrl.origin)
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
