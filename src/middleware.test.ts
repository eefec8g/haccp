/**
 * Tests unitaires du middleware d'authentification.
 *
 * Strategie de mock : `auth` de `@/lib/auth` est wrappe autour d'un
 * callback `(req) => NextResponse`. On stube `auth` pour qu'il retourne
 * directement le callback recu : on peut alors l'invoquer avec un faux
 * NextAuthRequest et inspecter la NextResponse renvoyee.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserRole } from '@prisma/client';

type MiddlewareCallback = (req: AuthRequest) => Promise<Response> | Response;

interface AuthSessionUser {
  id: string;
  email: string;
  role: UserRole;
  boutiqueIds: string[];
}

interface AuthRequest {
  nextUrl: URL;
  auth: { user: AuthSessionUser } | null;
}

vi.mock('@/lib/auth', () => ({
  auth: (cb: MiddlewareCallback) => cb,
}));

// Import APRES vi.mock : grace au hoisting de Vitest, vi.mock est evalue
// avant les imports, donc `auth` est deja stube quand middleware se charge.
import middleware from './middleware';

const ORIGIN = 'http://localhost:3000';

const handler = middleware as unknown as MiddlewareCallback;

function makeRequest(
  pathname: string,
  session: { user: AuthSessionUser } | null
): AuthRequest {
  return {
    nextUrl: new URL(pathname, ORIGIN),
    auth: session,
  };
}

function makeSession(role: UserRole): { user: AuthSessionUser } {
  return {
    user: {
      id: 'u1',
      email: 'test@maison-givre.fr',
      role,
      boutiqueIds: role === 'SALARIE' ? ['b1'] : [],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[middleware] anonymous users', () => {
  it('should let anonymous users access /login', async () => {
    const res = await handler(makeRequest('/login', null));

    expect(res.status).toBe(200);
    // NextResponse.next() => pas de Location header.
    expect(res.headers.get('location')).toBeNull();
  });

  it('should let anonymous users access /forgot-password', async () => {
    const res = await handler(makeRequest('/forgot-password', null));

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('should let anonymous users access nested /reset-password/:token', async () => {
    const res = await handler(makeRequest('/reset-password/abc123', null));

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('should redirect anonymous users from a protected path to /login with callbackUrl', async () => {
    const res = await handler(makeRequest('/releves', null));

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).not.toBeNull();
    const target = new URL(location ?? '', ORIGIN);
    expect(target.pathname).toBe('/login');
    expect(target.searchParams.get('callbackUrl')).toBe('/releves');
  });

  it('should redirect anonymous users from /admin to /login with callbackUrl', async () => {
    const res = await handler(makeRequest('/admin', null));

    expect(res.status).toBe(307);
    const target = new URL(res.headers.get('location') ?? '', ORIGIN);
    expect(target.pathname).toBe('/login');
    expect(target.searchParams.get('callbackUrl')).toBe('/admin');
  });
});

describe('[middleware] authenticated users on public paths', () => {
  it('should redirect a SALARIE away from /login to /dashboard', async () => {
    const res = await handler(makeRequest('/login', makeSession('SALARIE')));

    expect(res.status).toBe(307);
    const target = new URL(res.headers.get('location') ?? '', ORIGIN);
    expect(target.pathname).toBe('/dashboard');
  });

  it('should redirect a RESPONSABLE away from /login to /dashboard', async () => {
    const res = await handler(
      makeRequest('/login', makeSession('RESPONSABLE'))
    );

    expect(res.status).toBe(307);
    const target = new URL(res.headers.get('location') ?? '', ORIGIN);
    expect(target.pathname).toBe('/dashboard');
  });

  it('should redirect an ADMIN away from /login to /dashboard', async () => {
    const res = await handler(makeRequest('/login', makeSession('ADMIN')));

    expect(res.status).toBe(307);
    const target = new URL(res.headers.get('location') ?? '', ORIGIN);
    expect(target.pathname).toBe('/dashboard');
  });

  it('should redirect an authenticated user away from /forgot-password', async () => {
    const res = await handler(
      makeRequest('/forgot-password', makeSession('SALARIE'))
    );

    expect(res.status).toBe(307);
    const target = new URL(res.headers.get('location') ?? '', ORIGIN);
    expect(target.pathname).toBe('/dashboard');
  });
});

describe('[middleware] role-based access on protected paths', () => {
  it('should let an ADMIN access /admin', async () => {
    const res = await handler(makeRequest('/admin', makeSession('ADMIN')));

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('should let an ADMIN access nested admin routes', async () => {
    const res = await handler(
      makeRequest('/admin/users/42', makeSession('ADMIN'))
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('should redirect a SALARIE away from /admin to /dashboard', async () => {
    const res = await handler(makeRequest('/admin', makeSession('SALARIE')));

    expect(res.status).toBe(307);
    const target = new URL(res.headers.get('location') ?? '', ORIGIN);
    expect(target.pathname).toBe('/dashboard');
  });

  it('should redirect a RESPONSABLE away from /admin to /dashboard', async () => {
    const res = await handler(
      makeRequest('/admin', makeSession('RESPONSABLE'))
    );

    expect(res.status).toBe(307);
    const target = new URL(res.headers.get('location') ?? '', ORIGIN);
    expect(target.pathname).toBe('/dashboard');
  });

  it('should let a SALARIE access /releves', async () => {
    const res = await handler(makeRequest('/releves', makeSession('SALARIE')));

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('should let an ADMIN access /releves (admins can navigate everywhere)', async () => {
    const res = await handler(makeRequest('/releves', makeSession('ADMIN')));

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});

describe('[middleware] landing page (always public)', () => {
  it('should let anonymous users access /', async () => {
    const res = await handler(makeRequest('/', null));

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('should let an authenticated SALARIE access / without redirect', async () => {
    const res = await handler(makeRequest('/', makeSession('SALARIE')));

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('should let an authenticated ADMIN access / without redirect', async () => {
    const res = await handler(makeRequest('/', makeSession('ADMIN')));

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});

describe('[middleware] NextAuth internal routes', () => {
  it('should let any /api/auth/* request through without redirect (anonymous)', async () => {
    const res = await handler(makeRequest('/api/auth/session', null));

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('should let any /api/auth/* request through without redirect (authenticated)', async () => {
    const res = await handler(
      makeRequest('/api/auth/callback/credentials', makeSession('SALARIE'))
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});
