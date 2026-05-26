'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { releveAnnulationSchema } from '@/lib/validations/releve';
import { annulerReleve, type ReleveError } from '@/lib/services/releve.service';
import { checkRateLimit, toRetryAfterSeconds } from '@/lib/services/rateLimit';
import { getClientIp } from '@/lib/utils/request';
import { readRequiredString, readOptionalString } from '@/lib/utils/form-data';
import { ensureRoleOrError } from '@/lib/utils/server-action-guards';
import { dispatchAlerteEmail } from '@/lib/utils/dispatch-alerte-email';
import { logger } from '@/lib/logger';
import type {
  ReleveCorrectionActionErrorCode,
  ReleveCorrectionActionState,
} from './releve-correction.types';

/**
 * Server Action d'annulation/correction d'un releve (US-REL-004).
 *
 * Pipeline (calque admin-* actions) :
 *   1. auth() + guard RESPONSABLE/ADMIN (defense en profondeur, le
 *      middleware filtre deja en amont). Si pas de session ->
 *      redirect /login ; sinon role insuffisant -> FORBIDDEN.
 *   2. Rate-limit RELEVE_ANNULATION par user.id (operation rare et
 *      sensible : 10 / 1h, cf. RATE_LIMITS).
 *   3. Parse FormData. Le champ `replacementTemperature` est optionnel :
 *      absent -> pas de replacement ; present mais NaN -> erreur de
 *      validation localisee sur le champ.
 *   4. Validation Zod via `releveAnnulationSchema`.
 *   5. Delegation au service `annulerReleve` (Result pattern, transaction
 *      atomique : original annule + nouveau releve actif si replacement).
 *   6. revalidatePath('/releves') + revalidatePath('/releves/historique')
 *      puis redirect vers `/releves/historique` (defense vs. cache RSC).
 */

const RELEVES_PATH = '/releves';
const HISTORIQUE_PATH = '/releves/historique';

const FORBIDDEN_STATE: ReleveCorrectionActionState = {
  status: 'error',
  code: 'FORBIDDEN',
};

function mapServiceError(error: ReleveError): ReleveCorrectionActionErrorCode {
  if (error === 'NOT_FOUND') {
    return 'NOT_FOUND';
  }
  if (error === 'FORBIDDEN') {
    return 'FORBIDDEN';
  }
  if (error === 'ALREADY_CANCELLED') {
    return 'ALREADY_CANCELLED';
  }
  if (error === 'COMMENTAIRE_REQUIRED') {
    return 'COMMENTAIRE_REQUIRED';
  }
  return 'INTERNAL';
}

interface ReplacementParse {
  readonly ok: true;
  readonly value:
    | { readonly temperature: number; readonly commentaire?: string }
    | undefined;
}
interface ReplacementParseError {
  readonly ok: false;
  readonly state: ReleveCorrectionActionState;
}

/**
 * Convertit les champs `replacementTemperature` + `replacementCommentaire`
 * du FormData en un sous-objet typed pour Zod. Si `replacementTemperature`
 * est absent (ou vide), aucun replacement n'est demande -> undefined.
 * Sinon, il doit etre un nombre fini sinon on remonte une erreur de
 * validation localisee SANS appeler le service.
 */
function readReplacement(
  formData: FormData
): ReplacementParse | ReplacementParseError {
  const rawTemperature = readOptionalString(formData, 'replacementTemperature');
  if (rawTemperature === undefined) {
    return { ok: true, value: undefined };
  }
  const temperature = Number(rawTemperature);
  if (!Number.isFinite(temperature)) {
    return {
      ok: false,
      state: {
        status: 'error',
        code: 'VALIDATION',
        fieldErrors: {
          replacementTemperature: [
            'La temperature de remplacement doit etre un nombre.',
          ],
        },
      },
    };
  }
  const commentaire = readOptionalString(formData, 'replacementCommentaire');
  return {
    ok: true,
    value: commentaire ? { temperature, commentaire } : { temperature },
  };
}

/**
 * Annule un releve, optionnellement en creant un releve actif de
 * remplacement avec la vraie valeur. Pipeline auth -> rate-limit ->
 * validation -> service -> revalidate + redirect.
 */
export async function annulerReleveAction(
  _prev: ReleveCorrectionActionState,
  formData: FormData
): Promise<ReleveCorrectionActionState> {
  const guard = await ensureRoleOrError({
    allowedRoles: ['RESPONSABLE', 'ADMIN'],
    forbiddenState: FORBIDDEN_STATE,
  });
  if (!guard.ok) {
    return guard.state;
  }

  const rate = await checkRateLimit(
    'RELEVE_ANNULATION',
    `user:${guard.session.user.id}`
  );
  if (!rate.allowed) {
    return {
      status: 'error',
      code: 'RATE_LIMITED',
      retryAfterSeconds: toRetryAfterSeconds(rate.retryAfterMs),
    };
  }

  const replacement = readReplacement(formData);
  if (!replacement.ok) {
    return replacement.state;
  }

  const parsed = releveAnnulationSchema.safeParse({
    releveId: readRequiredString(formData, 'releveId'),
    motif: readRequiredString(formData, 'motif'),
    replacement: replacement.value,
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

  const result = await annulerReleve({
    viewer: {
      id: guard.session.user.id,
      role: guard.session.user.role,
    },
    input: parsed.data,
    ip,
  });

  if (!result.success) {
    const code = mapServiceError(result.error);
    if (code === 'INTERNAL') {
      logger.error('[releve-correction] service error', {
        viewerId: guard.session.user.id,
        releveId: parsed.data.releveId,
        error: result.error,
      });
    }
    return { status: 'error', code };
  }

  // M-1 : si le replacement a cree une alerte (replacement hors seuils),
  // RG-ALER-001 exige une notification immediate aux responsables.
  // Mutualise avec `releve-create.ts` via `dispatchAlerteEmail` (after()
  // fire-and-forget : ne ralentit pas la reponse, swallows transport errors).
  if (result.data.replacementAlerteId) {
    dispatchAlerteEmail(result.data.replacementAlerteId);
  }

  revalidatePath(RELEVES_PATH);
  revalidatePath(HISTORIQUE_PATH);
  redirect(HISTORIQUE_PATH);
}
