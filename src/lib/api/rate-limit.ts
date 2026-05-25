import type { NextRequest } from 'next/server';

/**
 * Helpers rate-limit pour les API routes (Route Handlers).
 *
 * Difference avec `@/lib/utils/request.ts` :
 *   - `lib/utils/request.ts` cible les Server Actions, qui recoivent
 *     leurs headers via `await headers()` (Promise<Headers>).
 *   - Ce fichier cible les API routes, qui recoivent un `NextRequest`
 *     dont les headers sont accessibles directement et synchroniquement.
 *
 * On garde les deux helpers separes plutot que de generaliser : la
 * signature de chacun reste honnete vis-a-vis de son call site et
 * evite des wrappers asynchrones inutiles cote Route Handler.
 */

const UNKNOWN_IP = 'unknown';

/**
 * Extrait l'IP client d'un `NextRequest`.
 *
 * Ordre de priorite (les premiers sont non-spoofables) :
 *   1. `x-vercel-forwarded-for` : pose par Vercel a partir de la
 *      connexion TCP reelle.
 *   2. `x-real-ip` : nginx / autres reverse proxies.
 *   3. `x-forwarded-for[0]` : premiere entree de la chaine XFF
 *      (spoofable hors Vercel mais utile en dev / autre infra).
 *   4. `'unknown'` : fallback, le rate-limiter applique alors la
 *      limite sur une cle commune.
 */
export function getClientIp(request: NextRequest): string {
  const vercel = request.headers.get('x-vercel-forwarded-for')?.trim();
  if (vercel) {
    return vercel.split(',')[0]?.trim() ?? UNKNOWN_IP;
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) {
    return realIp;
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }

  return UNKNOWN_IP;
}
