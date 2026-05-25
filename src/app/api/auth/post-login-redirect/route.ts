import { type UserRole } from '@prisma/client';
import { auth } from '@/lib/auth';
import { POST_LOGIN_REDIRECT } from '@/lib/constants/auth';

const HTTP_STATUS_OK = 200;
const FALLBACK_REDIRECT = '/login';

interface PostLoginRedirectResponse {
  readonly redirectTo: string;
}

function isKnownRole(role: string): role is UserRole {
  return role in POST_LOGIN_REDIRECT;
}

/**
 * Retourne `{ redirectTo }` calcule depuis la session courante.
 *
 * Appele par le client APRES un `signIn('credentials', { redirect: false })`
 * reussi. A ce moment, le cookie de session est POSE (NextAuth route handler
 * a deja repondu) donc `auth()` server-side retourne bien la session.
 *
 * Renvoie toujours un 200 (jamais d'erreur). Si la session est absente ou
 * le role inconnu, on renvoie `/login` : le middleware s'occupera de la
 * redirection authentifiee correcte au prochain hop.
 */
export async function GET(): Promise<Response> {
  const session = await auth();
  const role = session?.user?.role;

  if (!role || !isKnownRole(role)) {
    const payload: PostLoginRedirectResponse = {
      redirectTo: FALLBACK_REDIRECT,
    };
    return Response.json(payload, { status: HTTP_STATUS_OK });
  }

  const payload: PostLoginRedirectResponse = {
    redirectTo: POST_LOGIN_REDIRECT[role],
  };
  return Response.json(payload, { status: HTTP_STATUS_OK });
}
