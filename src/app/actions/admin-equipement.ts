'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';
import { auth } from '@/lib/auth';
import {
  equipementCreateSchema,
  equipementUpdateSchema,
} from '@/lib/validations/admin';
import {
  createEquipement,
  disableEquipement,
  enableEquipement,
  getEquipementById,
  updateEquipement,
  type EquipementError,
} from '@/lib/services/equipement.service';
import { ENTITY_DISABLE_MOTIF_MAX } from '@/lib/constants/admin';
import { assertAdminOrRedirect } from '@/lib/utils/admin-auth';

/**
 * Server Actions admin Equipement (US-ADM-002).
 *
 * Pipeline commun (mirror de admin-boutique.ts) :
 *   1. auth() + role ADMIN -> defense en profondeur cote action
 *   2. Parse FormData via Zod -> fieldErrors si invalid (seuils
 *      OBLIGATOIRES, decision Epic ADMIN #4)
 *   3. Delegation au service (Result pattern)
 *   4. revalidatePath('/admin/equipements') apres toute mutation
 *   5. redirect() ou return success selon le besoin UI
 *
 * Pour les boutons toggle (Promise<void>) on delegue le guard a
 * `assertAdminOrRedirect()` qui `redirect('/login')` proprement.
 */

const ADMIN_EQUIPEMENTS_PATH = '/admin/equipements';

export type EquipementActionErrorCode =
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'DUPLICATE'
  | 'BOUTIQUE_NOT_FOUND'
  | 'INVALID'
  | 'INTERNAL';

export interface EquipementActionFieldErrors {
  readonly nom?: readonly string[];
  readonly type?: readonly string[];
  readonly boutiqueId?: readonly string[];
  readonly seuilMin?: readonly string[];
  readonly seuilMax?: readonly string[];
  readonly id?: readonly string[];
}

export type EquipementActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'success' }
  | {
      readonly status: 'error';
      readonly code: EquipementActionErrorCode;
      readonly fieldErrors?: EquipementActionFieldErrors;
    };

export const INITIAL_EQUIPEMENT_ACTION_STATE: EquipementActionState = {
  status: 'idle',
};

interface AdminGuardOk {
  readonly ok: true;
  readonly session: Session;
}
interface AdminGuardKo {
  readonly ok: false;
  readonly state: EquipementActionState;
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

function mapServiceError(error: EquipementError): EquipementActionErrorCode {
  if (error === 'NOT_FOUND') {
    return 'NOT_FOUND';
  }
  if (error === 'DUPLICATE') {
    return 'DUPLICATE';
  }
  if (error === 'BOUTIQUE_NOT_FOUND') {
    return 'BOUTIQUE_NOT_FOUND';
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
 * Parse un champ numerique requis depuis le FormData. `''` -> NaN pour
 * que Zod (seuilField: z.number()) renvoie un message clair plutot
 * qu'un undefined silencieux (decision #4 : seuils obligatoires).
 */
function readRequiredNumber(formData: FormData, key: string): number {
  const raw = formData.get(key);
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return Number.NaN;
  }
  return Number(raw);
}

function readOptionalNumber(
  formData: FormData,
  key: string
): number | undefined {
  const raw = formData.get(key);
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return undefined;
  }
  return Number(raw);
}

/**
 * Cree un equipement puis redirige vers la page de detail. Le redirect
 * propage une erreur NEXT_REDIRECT volontairement non interceptee.
 */
export async function createEquipementAction(
  _prev: EquipementActionState,
  formData: FormData
): Promise<EquipementActionState> {
  const guard = await ensureAdmin();
  if (!guard.ok) {
    return guard.state;
  }

  const parsed = equipementCreateSchema.safeParse({
    nom: readRequiredString(formData, 'nom'),
    type: readRequiredString(formData, 'type'),
    boutiqueId: readRequiredString(formData, 'boutiqueId'),
    seuilMin: readRequiredNumber(formData, 'seuilMin'),
    seuilMax: readRequiredNumber(formData, 'seuilMax'),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      code: 'VALIDATION',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await createEquipement(parsed.data, guard.session.user.id);
  if (!result.success) {
    return { status: 'error', code: mapServiceError(result.error) };
  }

  revalidatePath(ADMIN_EQUIPEMENTS_PATH);
  redirect(`${ADMIN_EQUIPEMENTS_PATH}/${result.data.id}`);
}

/**
 * Normalise un motif optionnel : trim + tronque a la borne metier.
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
 * Met a jour un equipement existant. L'id est lu depuis le FormData
 * (pas un argument bound) pour rester compatible avec `useActionState`.
 */
export async function updateEquipementAction(
  _prev: EquipementActionState,
  formData: FormData
): Promise<EquipementActionState> {
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

  const parsed = equipementUpdateSchema.safeParse({
    nom: readOptionalString(formData, 'nom'),
    type: readOptionalString(formData, 'type'),
    boutiqueId: readOptionalString(formData, 'boutiqueId'),
    seuilMin: readOptionalNumber(formData, 'seuilMin'),
    seuilMax: readOptionalNumber(formData, 'seuilMax'),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      code: 'VALIDATION',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const existing = await getEquipementById(id);
  if (!existing.success) {
    return { status: 'error', code: 'NOT_FOUND' };
  }

  const result = await updateEquipement(id, parsed.data);
  if (!result.success) {
    return { status: 'error', code: mapServiceError(result.error) };
  }

  revalidatePath(ADMIN_EQUIPEMENTS_PATH);
  revalidatePath(`${ADMIN_EQUIPEMENTS_PATH}/${id}`);
  return { status: 'success' };
}

/**
 * Action invoquee par EntityDisableButton -> Promise<void>. Lance une
 * exception en cas d'erreur pour qu'`useTransition` la fasse remonter
 * cote client.
 */
export async function disableEquipementAction(
  id: string,
  motif?: string
): Promise<void> {
  const { userId } = await assertAdminOrRedirect();

  const result = await disableEquipement({
    id,
    performedById: userId,
    motif: sanitizeMotif(motif),
  });
  if (!result.success) {
    throw new Error('Equipement introuvable');
  }

  revalidatePath(ADMIN_EQUIPEMENTS_PATH);
  revalidatePath(`${ADMIN_EQUIPEMENTS_PATH}/${id}`);
}

export async function enableEquipementAction(id: string): Promise<void> {
  const { userId } = await assertAdminOrRedirect();

  const result = await enableEquipement({
    id,
    performedById: userId,
  });
  if (!result.success) {
    throw new Error('Equipement introuvable');
  }

  revalidatePath(ADMIN_EQUIPEMENTS_PATH);
  revalidatePath(`${ADMIN_EQUIPEMENTS_PATH}/${id}`);
}
