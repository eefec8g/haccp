import { after } from 'next/server';
import { Creneau } from '@prisma/client';
import {
  buildAlerteEmailContext,
  type AlerteEmailContext,
} from '@/lib/services/alerte.service';
import { sendAlerteEmail } from '@/lib/services/email-alerte.service';
import { logger } from '@/lib/logger';

/**
 * Dispatch fire-and-forget de l'email d'alerte (Epic ALERTE, RG-ALER-001).
 *
 * Factorise la logique partagee entre `releve-create.ts` (saisie initiale)
 * et `releve-correction.ts` (replacement hors seuils via annulation) :
 * sans cette factorisation, le replacement creait une `Alerte` sans email
 * (M-1).
 *
 * Pourquoi `after()` (next/server) ?
 *   - Decouplage strict : la reponse HTTP ne doit jamais etre bloquee
 *     par la latence SMTP (decision Epic #2, ENF-1 < 10s).
 *   - Aucun throw remonte au client : on log les erreurs en best-effort.
 *
 * Anti-leak : on NE LOG NI l'URL alerte (contient l'id), NI le commentaire
 * (PII potentielle), NI la liste des destinataires.
 */

const DEFAULT_APP_BASE_URL = 'http://localhost:3000';

/**
 * Recupere `APP_BASE_URL` pour construire les liens absolus emails.
 * En production, la variable DOIT etre definie : un fallback localhost
 * casserait les liens "voir l'alerte" sortants.
 */
function getAppBaseUrl(): string {
  const value = process.env.APP_BASE_URL;
  if (value) {
    return value;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('APP_BASE_URL is required in production');
  }
  return DEFAULT_APP_BASE_URL;
}

function buildAlerteUrl(alerteId: string): string {
  return `${getAppBaseUrl()}/alertes/${alerteId}`;
}

function isCreneau(value: string): value is Creneau {
  return value in Creneau;
}

function buildAlerteEmailPayload(
  alerteId: string,
  context: AlerteEmailContext,
  creneau: Creneau
): Parameters<typeof sendAlerteEmail>[0] {
  return {
    recipients: context.recipients,
    equipementNom: context.equipementNom,
    boutiqueNom: context.boutiqueNom,
    creneau,
    dateISO: context.releveDate.toISOString().slice(0, 10),
    temperature: context.temperature,
    seuilMin: context.seuilMin,
    seuilMax: context.seuilMax,
    commentaire: context.commentaire,
    alerteUrl: buildAlerteUrl(alerteId),
  };
}

/**
 * Plan le dispatch email post-response via `after()`. Si le contexte
 * email echoue (NOT_FOUND, creneau invalide) ou si le transport
 * retourne `success: false`, on log sans propager (l'alerte reste
 * visible en UI : un responsable peut la consulter sans email).
 */
export function dispatchAlerteEmail(alerteId: string): void {
  after(async () => {
    const context = await buildAlerteEmailContext(alerteId);
    if (!context.success) {
      logger.error('[dispatch-alerte-email] context build failed', {
        error: context.error,
      });
      return;
    }
    if (!isCreneau(context.data.creneau)) {
      logger.error('[dispatch-alerte-email] creneau invalide', {
        creneau: context.data.creneau,
      });
      return;
    }
    const payload = buildAlerteEmailPayload(
      alerteId,
      context.data,
      context.data.creneau
    );
    const result = await sendAlerteEmail(payload);
    if (!result.success) {
      logger.error('[dispatch-alerte-email] email send failed', {
        error: result.error,
      });
    }
  });
}
