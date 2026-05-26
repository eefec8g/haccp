'use server';

import { redirect } from 'next/navigation';
import { signOut } from '@/lib/auth';
import { isNextRedirectError } from '@/lib/utils/next-errors';

const LOGIN_PATH = '/login';

/**
 * Server Action de deconnexion.
 *
 * Pipeline :
 *   1. signOut NextAuth (clear cookie session) en best-effort
 *   2. redirect server-side vers /login
 *
 * Robustesse : si `signOut` echoue (Redis indispo, etc.), on redirige
 * quand meme. L'utilisateur ne doit jamais rester bloque sur un logout
 * et le middleware re-protegera les routes au prochain navigate.
 *
 * Securite : on ne log JAMAIS le sessionId ni l'email courant (RGPD,
 * pas de fuite info dans les logs serveur).
 */
export async function logoutAction(): Promise<never> {
  try {
    await signOut({ redirect: false });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    // Best-effort : on ignore silencieusement et on redirige.
  }

  redirect(LOGIN_PATH);
}
