/**
 * Longueur max d'un callbackUrl accepte. Au-dela, on le rejette
 * pour eviter qu'un attaquant ne forge des URLs internes monstrueuses
 * (DoS du parser, bypass de filtres, etc.). 500 chars couvre largement
 * tous les chemins legitimes de l'app.
 */
const MAX_CALLBACK_URL_LENGTH = 500;

const LOGIN_PATH = '/login';

/**
 * Securise une URL de redirection post-login fournie par le client
 * (typiquement via `?callbackUrl=...`).
 *
 * Defense contre les open-redirects : seuls les chemins internes sont
 * acceptes. Renvoie `null` si l'URL est :
 *   - vide / null / undefined ;
 *   - une URL absolue (`http://`, `https://`, ...) ;
 *   - protocol-relative (`//evil.com`) ;
 *   - un trick backslash (`/\\evil.com` peut etre interprete
 *     comme `//evil.com` par certains parsers) ;
 *   - une boucle vers `/login` (anti-loop post-auth) ;
 *   - trop longue (>500 chars).
 *
 * Sinon renvoie le path tel quel (query string et fragment conserves).
 */
export function sanitizeCallbackUrl(
  raw: string | null | undefined
): string | null {
  if (!raw) {
    return null;
  }
  if (raw.length > MAX_CALLBACK_URL_LENGTH) {
    return null;
  }
  if (!raw.startsWith('/')) {
    return null;
  }
  if (raw.startsWith('//')) {
    return null;
  }
  if (raw.startsWith('/\\')) {
    return null;
  }
  if (raw === LOGIN_PATH || raw.startsWith(`${LOGIN_PATH}?`)) {
    return null;
  }
  return raw;
}
