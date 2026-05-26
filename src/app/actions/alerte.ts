'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { resolveAlerte, type AlerteError } from '@/lib/services/alerte.service';
import { checkRateLimit, toRetryAfterSeconds } from '@/lib/services/rateLimit';
import { readRequiredString } from '@/lib/utils/form-data';
import { ensureRoleOrError } from '@/lib/utils/server-action-guards';
import { logger } from '@/lib/logger';
import {
  COMMENTAIRE_MAX_CHARS,
  COMMENTAIRE_MIN_CHARS,
} from '@/lib/constants/releve';
import type {
  AlerteActionErrorCode,
  AlerteResolveActionState,
} from './alerte.types';

/**
 * Server Action de resolution d'une alerte (US-ALE-002).
 *
 * Pipeline (defense en profondeur cote action) :
 *   1. auth() + guard RESPONSABLE/ADMIN. Sans session -> redirect
 *      `/login`. Role insuffisant -> FORBIDDEN (affiche un message).
 *   2. Rate-limit ALERTE_RESOLVE par user.id (30 / 1h cf. RATE_LIMITS).
 *   3. Validation Zod : alerteId UUID, commentaireResolution borne par
 *      `COMMENTAIRE_MIN_CHARS` / `COMMENTAIRE_MAX_CHARS` (constantes
 *      canoniques du domaine, cf. `@/lib/constants/releve`).
 *   4. Delegation au service `resolveAlerte` (Result pattern,
 *      transaction atomique).
 *   5. revalidatePath('/alertes') puis redirect vers `/alertes`.
 *
 * Le schema Zod est inline ici (2 champs, pas de reuse) : eviter de
 * polluer `validations/` avec un schema mono-callsite (YAGNI module).
 */

const ALERTES_PATH = '/alertes';

const FORBIDDEN_STATE: AlerteResolveActionState = {
  status: 'error',
  code: 'FORBIDDEN',
};

const resolveAlerteSchema = z.object({
  alerteId: z.string().uuid('Identifiant alerte invalide'),
  commentaireResolution: z
    .string()
    .trim()
    .min(
      COMMENTAIRE_MIN_CHARS,
      `Le commentaire doit faire au moins ${COMMENTAIRE_MIN_CHARS} caracteres`
    )
    .max(
      COMMENTAIRE_MAX_CHARS,
      `Le commentaire doit faire au plus ${COMMENTAIRE_MAX_CHARS} caracteres`
    ),
});

function mapServiceError(error: AlerteError): AlerteActionErrorCode {
  if (error === 'NOT_FOUND') {
    return 'NOT_FOUND';
  }
  if (error === 'FORBIDDEN') {
    return 'FORBIDDEN';
  }
  if (error === 'ALREADY_RESOLVED') {
    return 'ALREADY_RESOLVED';
  }
  return 'INTERNAL';
}

/**
 * Resout une alerte (US-ALE-002). Sur succes, redirige vers la liste
 * des alertes ouvertes.
 */
export async function resolveAlerteAction(
  _prev: AlerteResolveActionState,
  formData: FormData
): Promise<AlerteResolveActionState> {
  const guard = await ensureRoleOrError({
    allowedRoles: ['RESPONSABLE', 'ADMIN'],
    forbiddenState: FORBIDDEN_STATE,
  });
  if (!guard.ok) {
    return guard.state;
  }

  const rate = await checkRateLimit(
    'ALERTE_RESOLVE',
    `user:${guard.session.user.id}`
  );
  if (!rate.allowed) {
    return {
      status: 'error',
      code: 'RATE_LIMITED',
      retryAfterSeconds: toRetryAfterSeconds(rate.retryAfterMs),
    };
  }

  const parsed = resolveAlerteSchema.safeParse({
    alerteId: readRequiredString(formData, 'alerteId'),
    commentaireResolution: readRequiredString(
      formData,
      'commentaireResolution'
    ),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      code: 'VALIDATION',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await resolveAlerte({
    viewer: {
      id: guard.session.user.id,
      role: guard.session.user.role,
    },
    alerteId: parsed.data.alerteId,
    commentaireResolution: parsed.data.commentaireResolution,
  });

  if (!result.success) {
    const code = mapServiceError(result.error);
    if (code === 'INTERNAL') {
      logger.error('[alerte-resolve] service error', {
        viewerId: guard.session.user.id,
        alerteId: parsed.data.alerteId,
        error: result.error,
      });
    }
    return { status: 'error', code };
  }

  revalidatePath(ALERTES_PATH);
  redirect(ALERTES_PATH);
}
