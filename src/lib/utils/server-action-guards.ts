import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';
import type { UserRole } from '@prisma/client';
import { auth } from '@/lib/auth';

/**
 * Helpers de garde-fou centralises pour les Server Actions (Clean Code #4
 * DRY). Mutualisent le pattern repete dans `alerte.ts`, `releve-correction.ts`
 * et utilisable pour de futures actions role-scoped.
 *
 * Distinction vs `assertAdminOrRedirect` :
 *   - `assertAdminOrRedirect` est specifique aux Server Actions `Promise<void>`
 *     (boutons toggle) : redirige systematiquement en cas de refus.
 *   - `ensureRoleOrError` est dedie aux actions `useActionState` qui doivent
 *     retourner un `state` typed (FORBIDDEN) sans quitter la page. Sans
 *     session, redirige vers /login.
 *
 * Le caller doit fournir l'`forbiddenState` typed avec son etat d'action
 * (Result discriminated union par action).
 */

const LOGIN_PATH = '/login';

interface GuardOk {
  readonly ok: true;
  readonly session: Session;
}

interface GuardKo<TState> {
  readonly ok: false;
  readonly state: TState;
}

export type GuardResult<TState> = GuardOk | GuardKo<TState>;

interface EnsureRoleOrErrorArgs<TState> {
  readonly allowedRoles: readonly UserRole[];
  readonly forbiddenState: TState;
}

/**
 * Verifie qu'une session existe (sinon redirect /login) et que son role
 * est dans `allowedRoles`. Si le role est insuffisant, retourne
 * `forbiddenState` cote caller.
 */
export async function ensureRoleOrError<TState>({
  allowedRoles,
  forbiddenState,
}: EnsureRoleOrErrorArgs<TState>): Promise<GuardResult<TState>> {
  const session = await auth();
  if (!session?.user) {
    redirect(LOGIN_PATH);
  }
  if (!allowedRoles.includes(session.user.role)) {
    return { ok: false, state: forbiddenState };
  }
  return { ok: true, session };
}

interface EnsureAdminOrErrorArgs<TState> {
  readonly forbiddenState: TState;
}

/**
 * Specialisation de `ensureRoleOrError` pour les actions admin-only avec
 * etat `useActionState`. Conserve la difference semantique avec
 * `assertAdminOrRedirect` (qui s'applique aux actions void).
 */
export async function ensureAdminOrError<TState>({
  forbiddenState,
}: EnsureAdminOrErrorArgs<TState>): Promise<GuardResult<TState>> {
  return ensureRoleOrError({
    allowedRoles: ['ADMIN'],
    forbiddenState,
  });
}
