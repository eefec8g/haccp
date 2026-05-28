'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { releveCreateSchema } from '@/lib/validations/releve';
import { createReleve, type ReleveError } from '@/lib/services/releve.service';
import { checkRateLimit, toRetryAfterSeconds } from '@/lib/services/rateLimit';
import { getClientIp } from '@/lib/utils/request';
import { readRequiredString, readOptionalString } from '@/lib/utils/form-data';
import { dispatchAlerteEmail } from '@/lib/utils/dispatch-alerte-email';
import type {
  TourneeSaisieActionState,
  TourneeSaisieErrorCode,
} from './tournee-saisie.types';

/**
 * Server Action de saisie d'un releve depuis la tournee guidee
 * (feat/tournee-guidee).
 *
 * Difference avec `createReleveAction` :
 *   - Ne fait PAS de redirect : le composant client passe au step
 *     suivant via `setCurrentStep` apres reception du `status: 'success'`.
 *   - Renvoie `releve` (id + temperature + alerteHorsSeuils) pour que le
 *     client mette a jour son cache local et affiche le badge correct.
 *   - Revalidate `/dashboard` (vue tableau equipements x creneaux du
 *     jour). La page `/releves` redondante a ete supprimee : seul le
 *     dashboard porte desormais l'etat des creneaux a rafraichir.
 *
 * Pipeline identique au reste :
 *   1. auth() (tout role authentifie peut saisir).
 *   2. Rate-limit RELEVE_CREATE par user.id (60 / 5 min).
 *   3. Parse + Zod releveCreateSchema.
 *   4. Service createReleve (Result pattern).
 *   5. Dispatch email d'alerte si hors seuils (fire-and-forget).
 */

const DASHBOARD_PATH = '/dashboard';

function mapServiceError(error: ReleveError): TourneeSaisieErrorCode {
  switch (error) {
    case 'EQUIPEMENT_NOT_FOUND':
      return 'EQUIPEMENT_NOT_FOUND';
    case 'EQUIPEMENT_INACTIVE':
      return 'EQUIPEMENT_INACTIVE';
    case 'BOUTIQUE_FORBIDDEN':
      return 'BOUTIQUE_FORBIDDEN';
    case 'ALREADY_EXISTS':
      return 'ALREADY_EXISTS';
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

export async function tourneeSaisieAction(
  _prev: TourneeSaisieActionState,
  formData: FormData
): Promise<TourneeSaisieActionState> {
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

  const temperatureRaw = readRequiredString(formData, 'temperature');
  const temperature = parseTemperature(temperatureRaw);

  const parsed = releveCreateSchema.safeParse({
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

  const viewerBoutiqueIds =
    session.user.role === 'ADMIN' ? undefined : session.user.boutiqueIds;

  const result = await createReleve({
    viewer: { id: session.user.id, role: session.user.role },
    input: { ...parsed.data, ip },
    viewerBoutiqueIds,
  });
  if (!result.success) {
    return { status: 'error', code: mapServiceError(result.error) };
  }

  if (result.data.alerteCreated && result.data.alerteId) {
    dispatchAlerteEmail(result.data.alerteId);
  }

  revalidatePath(DASHBOARD_PATH);

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
