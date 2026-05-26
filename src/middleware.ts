import { NextResponse } from 'next/server';
import type { UserRole } from '@prisma/client';
import { auth } from '@/lib/auth';
import { POST_LOGIN_REDIRECT } from '@/lib/constants/auth';

/**
 * Routes publiques d'authentification :
 * - Accessibles aux anonymes
 * - Redirigent les users deja authentifies vers leur espace
 *   (on ne veut pas qu'un user connecte voit /login)
 */
const AUTH_PUBLIC_PATHS = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/accept-invitation',
];

/**
 * Routes "always public" : accessibles a tous, quel que soit l'etat
 * de session. La landing (`/`) en fait partie : un user connecte doit
 * pouvoir revenir voir la vitrine. Le CTA du header est contextuel.
 */
const ALWAYS_PUBLIC_PATHS = ['/'];

const ADMIN_PATHS = ['/admin'];

const FALLBACK_REDIRECT = '/login';

function matchesPath(pathname: string, paths: readonly string[]): boolean {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAuthPublicPath(pathname: string): boolean {
  return matchesPath(pathname, AUTH_PUBLIC_PATHS);
}

function isAlwaysPublicPath(pathname: string): boolean {
  return matchesPath(pathname, ALWAYS_PUBLIC_PATHS);
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

function redirectTargetFor(role: UserRole | undefined): string {
  if (!role || !(role in POST_LOGIN_REDIRECT)) {
    // Defense en profondeur : un JWT avec role inattendu ne doit jamais
    // etre traite comme un role valide. On loggue et on renvoie vers /login.
    if (role) {
      console.warn(`[middleware] role inattendu dans JWT : ${role}`);
    }
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

  // La landing et les autres chemins always-public sont accessibles a tous.
  // On n'applique pas la regle "redirect-if-authenticated" pour eux.
  if (isAlwaysPublicPath(pathname)) {
    return NextResponse.next();
  }

  const isAuthPublic = isAuthPublicPath(pathname);

  if (!isAuthenticated && !isAuthPublic) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isAuthPublic) {
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
