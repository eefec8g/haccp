/**
 * Helper client : recupere l'URL de redirection post-login en fonction
 * du role de l'utilisateur connecte.
 *
 * Pourquoi un fetch GET et pas un calcul cote client ?
 *   - Le client n'a pas le role tant qu'il n'a pas appele `auth()`.
 *   - `auth()` cote client passerait par `/api/auth/session` (NextAuth)
 *     mais c'est un endpoint qui retourne potentiellement plus d'infos
 *     que necessaire (token, expires, etc.).
 *   - On preferre un endpoint dedie `/api/auth/post-login-redirect`
 *     qui encapsule la logique POST_LOGIN_REDIRECT[role] et retourne
 *     UNIQUEMENT le `redirectTo`. SRP cote API + leak minimal.
 *
 * Pattern aligne sur C8GApp (`fetchPostLoginRoute`).
 */

const DEFAULT_REDIRECT = '/login';

interface PostLoginRedirectPayload {
  readonly redirectTo?: string;
}

/**
 * Recupere via GET `/api/auth/post-login-redirect` le `redirectTo` calcule
 * cote serveur depuis la session courante. Tolere les erreurs reseau et
 * les payloads malformes : retourne `'/login'` par defaut, ce qui force
 * un nouveau passage par le middleware (defensif).
 */
export async function fetchPostLoginRoute(): Promise<string> {
  try {
    const response = await fetch('/api/auth/post-login-redirect');
    if (!response.ok) {
      return DEFAULT_REDIRECT;
    }
    const payload: PostLoginRedirectPayload = await response.json();
    return typeof payload.redirectTo === 'string'
      ? payload.redirectTo
      : DEFAULT_REDIRECT;
  } catch {
    return DEFAULT_REDIRECT;
  }
}
