'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { releveCorrectionSchema } from '@/lib/validations/releve';
import {
  corrigerPropreReleveDuJour,
  type ReleveError,
} from '@/lib/services/releve.service';
import { checkRateLimit, toRetryAfterSeconds } from '@/lib/services/rateLimit';
import { getClientIp } from '@/lib/utils/request';
import { readRequiredString, readOptionalString } from '@/lib/utils/form-data';
import { dispatchAlerteEmail } from '@/lib/utils/dispatch-alerte-email';
import type {
  TourneeCorrectionActionState,
  TourneeCorrectionErrorCode,
} from './tournee-correction.types';

/**
 * Server Action de correction d'un releve depuis le recap de la tournee
 * guidee (fix/signature-action-context).
 *
 * Le SALARIE (auteur) corrige SA PROPRE saisie du jour AVANT signature :
 * la correction est une annulation tracee (motif auto) + un nouveau
 * releve actif (RG-IMMU-001), jamais un UPDATE/DELETE.
 *
 * Difference avec `tourneeSaisieAction` :
 *   - Delegue a `corrigerPropreReleveDuJour` (garde-fous auteur + jour +
 *     non signe), pas a `createReleve`.
 *   - Renvoie l'id du NOUVEAU releve pour mise a jour du recap client.
 *
 * Pipeline :
 *   1. auth() (tout role authentifie ; les garde-fous "auteur" sont au
 *      niveau service pour eviter toute escalade).
 *   2. Rate-limit RELEVE_CREATE par user.id (saisie operationnelle).
 *   3. Parse + Zod releveCorrectionSchema.
 *   4. Service corrigerPropreReleveDuJour (Result pattern, transaction).
 *   5. Dispatch email d'alerte si la nouvelle valeur est hors seuils.
 */

const DASHBOARD_PATH = '/dashboard';
const RELEVES_PATH = '/releves';

function mapServiceError(error: ReleveError): TourneeCorrectionErrorCode {
  switch (error) {
    case 'NOT_FOUND':
      return 'NOT_FOUND';
    case 'FORBIDDEN':
    case 'BOUTIQUE_FORBIDDEN':
      return 'FORBIDDEN';
    case 'NOT_TODAY':
      return 'NOT_TODAY';
    case 'CRENEAU_MISMATCH':
      return 'CRENEAU_MISMATCH';
    case 'ALREADY_CANCELLED':
      return 'ALREADY_CANCELLED';
    case 'TOURNEE_DEJA_SIGNEE':
      return 'TOURNEE_DEJA_SIGNEE';
    case 'COMMENTAIRE_REQUIRED':
      return 'COMMENTAIRE_REQUIRED';
    default:
      return 'INTERNAL';
  }
}

function parseTemperature(raw: string): number | null {
  if (raw.length === 0) {
    return null;
  }
  const normalized = raw.replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export async function tourneeCorrigeAction(
  _prev: TourneeCorrectionActionState,
  formData: FormData
): Promise<TourneeCorrectionActionState> {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const rate = await checkRateLimit('RELEVE_CREATE', `user:${session.user.id}`);
  if (!rate.allowed) {
    return {
      status: 'error',
      code: 'RATE_LIMITED',
      retryAfterSeconds: toRetryAfterSeconds(rate.retryAfterMs),
    };
  }

  const temperature = parseTemperature(
    readRequiredString(formData, 'temperature')
  );
  const parsed = releveCorrectionSchema.safeParse({
    releveId: readRequiredString(formData, 'releveId'),
    equipementId: readRequiredString(formData, 'equipementId'),
    creneau: readRequiredString(formData, 'creneau'),
    temperature,
    commentaire: readOptionalString(formData, 'commentaire'),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      code: 'VALIDATION',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const requestHeaders = await headers();
  const ip = getClientIp(requestHeaders);

  const result = await corrigerPropreReleveDuJour({
    viewer: { id: session.user.id, role: session.user.role },
    input: parsed.data,
    ip,
  });
  if (!result.success) {
    return { status: 'error', code: mapServiceError(result.error) };
  }

  if (result.data.alerteCreated && result.data.alerteId) {
    dispatchAlerteEmail(result.data.alerteId);
  }

  revalidatePath(DASHBOARD_PATH);
  revalidatePath(RELEVES_PATH);

  return {
    status: 'success',
    equipementId: parsed.data.equipementId,
    releve: {
      id: result.data.releveId,
      temperature: parsed.data.temperature,
      alerteHorsSeuils: result.data.alerteCreated,
      saisiAt: result.data.createdAt.toISOString(),
    },
  };
}
