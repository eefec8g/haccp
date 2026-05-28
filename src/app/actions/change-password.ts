'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { changePasswordSchema } from '@/lib/validations/auth';
import {
  changePassword,
  type ChangePasswordError,
} from '@/lib/services/auth.service';
import type {
  ChangePasswordActionState,
  ChangePasswordErrorCode,
} from './change-password.types';

/**
 * Mappe une erreur service vers une cle d'erreur UI. La separation
 * service/UI evite de fuiter la structure interne et garde un point
 * unique de traduction des codes (Clean Code #4 DRY, #1 Securite).
 */
function toErrorCode(error: ChangePasswordError): ChangePasswordErrorCode {
  return error;
}

/**
 * Server Action de changement de mot de passe (utilisateur connecte).
 *
 * Pipeline :
 *   1. auth() -> redirect /login si pas de session.
 *   2. validation Zod (mdp actuel non vide, nouveau fort, confirm match).
 *   3. service changePassword scope sur `session.user.id` (jamais un id
 *      issu du formulaire : un user ne change QUE son propre mot de passe).
 *   4. mapping des erreurs service -> code UI.
 *
 * Securite : aucun mot de passe (clair ou hash) n'est journalise ; on ne
 * retourne que des codes d'erreur generiques cote UI.
 */
export async function changePasswordAction(
  _prev: ChangePasswordActionState,
  formData: FormData
): Promise<ChangePasswordActionState> {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) {
    return { status: 'error', code: 'VALIDATION' };
  }

  const result = await changePassword({
    userId: session.user.id,
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
  });

  if (!result.success) {
    return { status: 'error', code: toErrorCode(result.error) };
  }

  return { status: 'success' };
}
