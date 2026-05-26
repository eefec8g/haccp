import { db } from '@/lib/prisma';
import type { Result } from '@/types/result';
import type { AuditTransactionClient } from '@/lib/services/audit-log.service';

/**
 * Service Alerte (Epic ALERTE, socle minimal pose dans Epic RELEVE).
 *
 * Responsabilites couvertes Phase 1 (RELEVE) :
 *   - `createAlerte` : CREATE Alerte attachee a un releve hors seuils,
 *     dans une transaction Prisma fournie par createReleve.
 *   - `sendAlerteEmail` : best-effort, log les erreurs sans throw.
 *
 * Les flows "lister/resoudre/ignorer" (US-ALE-001/002) sont hors
 * perimetre de l'Epic RELEVE et seront ajoutes par l'Epic ALERTE.
 */

export type AlerteError = 'NOT_FOUND' | 'RELEVE_NOT_FOUND';

interface CreateAlerteArgs {
  readonly releveId: string;
  readonly tx?: AuditTransactionClient;
}

/**
 * Cree une alerte OUVERTE rattachee a un releve. La table Alerte a une
 * contrainte unique sur `releveId` : appel idempotent au niveau base
 * (P2002 si deja existante).
 *
 * Doit etre appele DANS la transaction de createReleve pour rester
 * atomique : si la creation du releve echoue, l'alerte rollback.
 */
export async function createAlerte({
  releveId,
  tx,
}: CreateAlerteArgs): Promise<{ readonly id: string }> {
  const client = tx ?? db;
  const alerte = await client.alerte.create({
    data: {
      releveId,
      status: 'OUVERTE',
    },
    select: { id: true },
  });
  return { id: alerte.id };
}

interface AlerteEmailContext {
  readonly alerteId: string;
  readonly releveDate: Date;
  readonly creneau: string;
  readonly temperature: number;
  readonly commentaire: string | null;
  readonly equipementNom: string;
  readonly seuilMin: number;
  readonly seuilMax: number;
  readonly boutiqueNom: string;
  /** Liste des destinataires (responsables + admins de la boutique). */
  readonly recipients: readonly string[];
}

/**
 * Charge le contexte email d'une alerte : releve, equipement, seuils,
 * boutique, destinataires (responsables actifs de la boutique + admins).
 *
 * Pas d'envoi ici, juste la projection des donnees - facilite le test
 * (mocker la DB plutot que le service email).
 */
export async function buildAlerteEmailContext(
  alerteId: string
): Promise<Result<AlerteEmailContext, AlerteError>> {
  const alerte = await db.alerte.findUnique({
    where: { id: alerteId },
    select: {
      id: true,
      releve: {
        select: {
          date: true,
          creneau: true,
          temperature: true,
          commentaire: true,
          equipement: {
            select: { nom: true, seuilMin: true, seuilMax: true },
          },
          boutique: {
            select: {
              id: true,
              nom: true,
              responsables: {
                select: {
                  user: { select: { email: true, actif: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!alerte) {
    return { success: false, error: 'NOT_FOUND' };
  }

  const recipients = alerte.releve.boutique.responsables
    .map((row) => row.user)
    .filter((user) => user.actif)
    .map((user) => user.email);

  return {
    success: true,
    data: {
      alerteId: alerte.id,
      releveDate: alerte.releve.date,
      creneau: alerte.releve.creneau,
      temperature: alerte.releve.temperature,
      commentaire: alerte.releve.commentaire,
      equipementNom: alerte.releve.equipement.nom,
      seuilMin: alerte.releve.equipement.seuilMin,
      seuilMax: alerte.releve.equipement.seuilMax,
      boutiqueNom: alerte.releve.boutique.nom,
      recipients,
    },
  };
}
