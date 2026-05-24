const UNKNOWN_IP = 'unknown';

/**
 * Extrait l'IP du client a partir des headers de la requete.
 *
 * Ordre de priorite (les premiers ne sont pas spoofables) :
 *   1. `x-vercel-forwarded-for` : injecte par Vercel a partir de la connexion
 *      TCP reelle, donc non spoofable par le client (contrairement a XFF).
 *   2. `x-real-ip` : pose par certains reverse proxies (nginx).
 *   3. `x-forwarded-for[0]` : premiere entree (client originel) ; spoofable
 *      hors Vercel mais utile en local / autre infra.
 *   4. Fallback `'unknown'` : le rate-limiter applique alors la limite sur
 *      une cle commune ; suffisant en local mais a tightener en prod.
 */
export function getClientIp(requestHeaders: Headers): string {
  const vercel = requestHeaders.get('x-vercel-forwarded-for')?.trim();
  if (vercel) {
    return vercel.split(',')[0]?.trim() ?? UNKNOWN_IP;
  }

  const realIp = requestHeaders.get('x-real-ip')?.trim();
  if (realIp) {
    return realIp;
  }

  const forwardedFor = requestHeaders.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }

  return UNKNOWN_IP;
}
