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
  ReleveCreateActionErrorCode,
  ReleveCreateActionState,
} from './releve-create.types';

/**
 * Server Action createReleve (US-REL-002 + US-ALE-003).
 *
 * Pipeline :
 *   1. auth() (tout role authentifie peut saisir)
 *   2. Rate-limit RELEVE_CREATE par user.id (60 / 5 min)
 *   3. Parse FormData (temperature coercion Number)
 *   4. Zod releveCreateSchema
 *   5. Lecture IP (signature serveur)
 *   6. Service createReleve (Result pattern)
 *   7. Sur alerteHorsSeuils : dispatch email via `after()` (fire-and-forget,
 *      decision #2 du Epic state). Aucune latence ajoutee a la reponse.
 *      Mutualise avec `releve-correction.ts` via `dispatchAlerteEmail`.
 *   8. revalidatePath('/dashboard') + redirect (POST-redirect-GET)
 *
 * L'envoi email est volontairement isole de `createReleve` (le service
 * n'orchestre que la DB transactionnelle). Si l'email echoue, l'alerte
 * reste creee en base : le responsable peut la consulter via l'UI.
 *
 * Note routing : la vue tournee a ete fusionnee dans `/dashboard`
 * (suppression de la page `/releves` redondante). Apres saisie on
 * revalide et redirige donc vers le dashboard, qui affiche l'etat a jour
 * des creneaux du jour.
 */

const DASHBOARD_PATH = '/dashboard';

function mapServiceError(error: ReleveError): ReleveCreateActionErrorCode {
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

export async function createReleveAction(
  _prev: ReleveCreateActionState,
  formData: FormData
): Promise<ReleveCreateActionState> {
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

  // Optim : on shortcut le query DB des boutiques accessibles UNIQUEMENT
  // si le viewer a un scope ferme en session (SALARIE/RESPONSABLE). Pour
  // ADMIN la session porte `[]` (resolu cote service en "toutes les
  // boutiques actives") : on laisse alors le service requeter.
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
  redirect(DASHBOARD_PATH);
}
