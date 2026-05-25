'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';
import { auth } from '@/lib/auth';
import {
  boutiqueCreateSchema,
  boutiqueUpdateSchema,
} from '@/lib/validations/admin';
import {
  createBoutique,
  disableBoutique,
  enableBoutique,
  getBoutiqueById,
  updateBoutique,
  type BoutiqueError,
} from '@/lib/services/boutique.service';
import { ENTITY_DISABLE_MOTIF_MAX } from '@/lib/constants/admin';
import { assertAdminOrRedirect } from '@/lib/utils/admin-auth';

/**
 * Server Actions admin Boutique (US-ADM-001).
 *
 * Pipeline commun (regle Clean Code #1) :
 *   1. auth() + role ADMIN (defense en profondeur cote action, en plus
 *      du middleware + layout).
 *   2. Parse FormData via Zod -> fieldErrors si invalid.
 *   3. Delegation au service (Result pattern).
 *   4. revalidatePath('/admin/boutiques') apres toute mutation.
 *   5. redirect() ou return success selon le besoin UI.
 *
 * Pour les boutons toggle (Promise<void>) on delegue le guard a
 * `assertAdminOrRedirect()` qui `redirect('/login')` proprement.
 */

const ADMIN_BOUTIQUES_PATH = '/admin/boutiques';

export type BoutiqueActionErrorCode =
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'DUPLICATE'
  | 'INVALID'
  | 'INTERNAL';

export interface BoutiqueActionFieldErrors {
  readonly nom?: readonly string[];
  readonly adresse?: readonly string[];
  readonly ville?: readonly string[];
  readonly id?: readonly string[];
}

export type BoutiqueActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'success' }
  | {
      readonly status: 'error';
      readonly code: BoutiqueActionErrorCode;
      readonly fieldErrors?: BoutiqueActionFieldErrors;
    };

export const INITIAL_BOUTIQUE_ACTION_STATE: BoutiqueActionState = {
  status: 'idle',
};

interface AdminGuardOk {
  readonly ok: true;
  readonly session: Session;
}
interface AdminGuardKo {
  readonly ok: false;
  readonly state: BoutiqueActionState;
}
type AdminGuardResult = AdminGuardOk | AdminGuardKo;

async function ensureAdmin(): Promise<AdminGuardResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return {
      ok: false,
      state: { status: 'error', code: 'FORBIDDEN' },
    };
  }
  return { ok: true, session };
}

function mapServiceError(error: BoutiqueError): BoutiqueActionErrorCode {
  if (error === 'NOT_FOUND') {
    return 'NOT_FOUND';
  }
  if (error === 'DUPLICATE') {
    return 'DUPLICATE';
  }
  return 'INVALID';
}

function readOptionalString(
  formData: FormData,
  key: string
): string | undefined {
  const raw = formData.get(key);
  if (typeof raw !== 'string') {
    return undefined;
  }
  return raw;
}

function readRequiredString(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw : '';
}

/**
 * Cree une boutique puis redirige vers la page de detail. Le redirect
 * propage une erreur NEXT_REDIRECT volontairement non interceptee.
 */
export async function createBoutiqueAction(
  _prev: BoutiqueActionState,
  formData: FormData
): Promise<BoutiqueActionState> {
  const guard = await ensureAdmin();
  if (!guard.ok) {
    return guard.state;
  }

  const parsed = boutiqueCreateSchema.safeParse({
    nom: readRequiredString(formData, 'nom'),
    adresse: readOptionalString(formData, 'adresse'),
    ville: readOptionalString(formData, 'ville'),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      code: 'VALIDATION',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await createBoutique(parsed.data, guard.session.user.id);
  if (!result.success) {
    return { status: 'error', code: mapServiceError(result.error) };
  }

  revalidatePath(ADMIN_BOUTIQUES_PATH);
  redirect(`${ADMIN_BOUTIQUES_PATH}/${result.data.id}`);
}

/**
 * Normalise un motif optionnel : trim + tronque a la borne metier
 * (defense en profondeur, Zod le valide deja cote formulaire).
 */
function sanitizeMotif(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed.slice(0, ENTITY_DISABLE_MOTIF_MAX);
}

/**
 * Met a jour une boutique existante. L'id est lu depuis le FormData
 * (pas un argument bound) pour rester compatible avec `useActionState`
 * et un seul wrapper Server Action cote client.
 */
export async function updateBoutiqueAction(
  _prev: BoutiqueActionState,
  formData: FormData
): Promise<BoutiqueActionState> {
  const guard = await ensureAdmin();
  if (!guard.ok) {
    return guard.state;
  }

  const id = readRequiredString(formData, 'id');
  if (!id) {
    return {
      status: 'error',
      code: 'VALIDATION',
      fieldErrors: { id: ['Identifiant manquant'] },
    };
  }

  const parsed = boutiqueUpdateSchema.safeParse({
    nom: readOptionalString(formData, 'nom'),
    adresse: readOptionalString(formData, 'adresse'),
    ville: readOptionalString(formData, 'ville'),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      code: 'VALIDATION',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const existing = await getBoutiqueById(id);
  if (!existing.success) {
    return { status: 'error', code: 'NOT_FOUND' };
  }

  const result = await updateBoutique(id, parsed.data);
  if (!result.success) {
    return { status: 'error', code: mapServiceError(result.error) };
  }

  revalidatePath(ADMIN_BOUTIQUES_PATH);
  revalidatePath(`${ADMIN_BOUTIQUES_PATH}/${id}`);
  return { status: 'success' };
}

/**
 * Action invoquee par le bouton "Desactiver" -> retour Promise<void>
 * pour rester compatible avec `EntityDisableButton`. Une exception
 * est levee si la boutique est introuvable pour qu'`useTransition`
 * fasse remonter l'erreur cote client.
 *
 * `motif` est optionnel (mais recommande HACCP) : il est journalise
 * dans AuditLog par le service.
 */
export async function disableBoutiqueAction(
  id: string,
  motif?: string
): Promise<void> {
  const { userId } = await assertAdminOrRedirect();

  const result = await disableBoutique({
    id,
    performedById: userId,
    motif: sanitizeMotif(motif),
  });
  if (!result.success) {
    throw new Error('Boutique introuvable');
  }

  revalidatePath(ADMIN_BOUTIQUES_PATH);
  revalidatePath(`${ADMIN_BOUTIQUES_PATH}/${id}`);
}

export async function enableBoutiqueAction(id: string): Promise<void> {
  const { userId } = await assertAdminOrRedirect();

  const result = await enableBoutique({
    id,
    performedById: userId,
  });
  if (!result.success) {
    throw new Error('Boutique introuvable');
  }

  revalidatePath(ADMIN_BOUTIQUES_PATH);
  revalidatePath(`${ADMIN_BOUTIQUES_PATH}/${id}`);
}
