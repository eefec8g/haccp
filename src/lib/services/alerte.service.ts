import {
  AlerteStatus,
  Prisma,
  type Creneau,
  type TypeEquipement,
} from '@prisma/client';
import { db } from '@/lib/prisma';
import type { Result } from '@/types/result';
import type { AuditTransactionClient } from '@/lib/services/audit-log.service';
import type { PaginatedResult, PaginationQuery } from '@/types/admin';
import { buildPaginated } from '@/lib/utils/pagination';
import {
  canManageAlertes,
  getAccessibleBoutiqueIds,
  type SessionUser,
} from '@/lib/permissions';
import { logger } from '@/lib/logger';

/**
 * Service Alerte (Epic ALERTE).
 *
 * Responsabilites :
 *   - `createAlerte` : CREATE Alerte attachee a un releve hors seuils,
 *     dans une transaction Prisma fournie par createReleve.
 *   - `buildAlerteEmailContext` : projection email best-effort.
 *   - `listAlertesOuvertes` (US-ALE-001) : liste paginee des alertes
 *     OUVERTE scopees aux boutiques accessibles au viewer.
 *   - `getAlerteById` (US-ALE-001 detail) : projection d'une alerte
 *     avec verification de scope.
 *   - `resolveAlerte` (US-ALE-002) : passe une alerte a RESOLUE avec
 *     commentaire de resolution + tracabilite (resoluParId, resoluAt).
 *
 * L'enum `AuditEntityType` Prisma ne contient pas `ALERTE` : la
 * tracabilite de resolution est portee directement par la ligne
 * `Alerte` (resoluParId / resoluAt / commentaireResolution) qui est en
 * pratique immuable une fois renseignee (un update vers RESOLUE depuis
 * RESOLUE est bloque applicativement). Cette table EST le journal
 * d'audit metier des alertes.
 */

export type AlerteError =
  | 'NOT_FOUND'
  | 'RELEVE_NOT_FOUND'
  | 'FORBIDDEN'
  | 'ALREADY_RESOLVED';

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
      status: AlerteStatus.OUVERTE,
    },
    select: { id: true },
  });
  return { id: alerte.id };
}

export interface AlerteEmailContext {
  readonly alerteId: string;
  readonly releveDate: Date;
  readonly creneau: string;
  readonly temperature: number;
  readonly commentaire: string | null;
  readonly equipementNom: string;
  readonly seuilMin: number;
  readonly seuilMax: number;
  readonly boutiqueNom: string;
  /** Liste des destinataires (responsables actifs de la boutique). */
  readonly recipients: readonly string[];
}

/**
 * Charge le contexte email d'une alerte : releve, equipement, seuils,
 * boutique, destinataires (responsables ACTIFS de la boutique).
 *
 * Les ADMIN ne sont volontairement PAS inclus : ils consultent le tableau
 * de bord transverse via l'UI. Si une extension "audit transverse" devient
 * necessaire, ajouter ici :
 *   `db.user.findMany({ where: { role: 'ADMIN', actif: true }, select: { email: true } })`
 * puis merge des emails (avec dedoublonnage).
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

// ===== US-ALE-001 : Liste des alertes ouvertes =====

/**
 * Projection d'une alerte pour les listings et la page detail
 * (US-ALE-001/002). Volontairement plate : pas de Date hors `createdAt`
 * et `releve.dateISO` (string ISO `YYYY-MM-DD`) pour eviter les
 * decalages timezone cote UI.
 */
export interface AlerteListItem {
  readonly id: string;
  readonly status: AlerteStatus;
  readonly createdAt: Date;
  readonly releve: {
    readonly id: string;
    readonly dateISO: string;
    readonly creneau: Creneau;
    readonly temperature: number;
    readonly commentaire: string | null;
    readonly equipementNom: string;
    readonly equipementType: TypeEquipement;
    readonly boutiqueId: string;
    readonly boutiqueNom: string;
    readonly seuilMin: number;
    readonly seuilMax: number;
  };
}

/**
 * `select` precis (vs `include` plat sur releve qui chargerait signature,
 * ip, motifAnnulation, etc. inutiles pour le listing). Le type
 * `AlerteWithReleveRow` est derive automatiquement via
 * `Prisma.AlerteGetPayload`, ce qui supprime les casts `as`.
 */
const ALERTE_LIST_SELECT = {
  id: true,
  status: true,
  createdAt: true,
  releve: {
    select: {
      id: true,
      date: true,
      creneau: true,
      temperature: true,
      commentaire: true,
      boutiqueId: true,
      equipement: {
        select: { nom: true, type: true, seuilMin: true, seuilMax: true },
      },
      boutique: { select: { nom: true } },
    },
  },
} as const satisfies Prisma.AlerteSelect;

type AlerteWithReleveRow = Prisma.AlerteGetPayload<{
  select: typeof ALERTE_LIST_SELECT;
}>;

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mapAlerteRow(row: AlerteWithReleveRow): AlerteListItem {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    releve: {
      id: row.releve.id,
      dateISO: toISODate(row.releve.date),
      creneau: row.releve.creneau,
      temperature: row.releve.temperature,
      commentaire: row.releve.commentaire,
      equipementNom: row.releve.equipement.nom,
      equipementType: row.releve.equipement.type,
      boutiqueId: row.releve.boutiqueId,
      boutiqueNom: row.releve.boutique.nom,
      seuilMin: row.releve.equipement.seuilMin,
      seuilMax: row.releve.equipement.seuilMax,
    },
  };
}

interface ListAlertesOuvertesArgs {
  readonly viewer: SessionUser;
  readonly pagination: PaginationQuery;
}

/**
 * Liste paginee des alertes status OUVERTE des boutiques accessibles
 * au viewer (US-ALE-001).
 *
 * - SALARIE : sa boutique unique (lecture seule, il consulte les alertes
 *   qui le concernent ; la resolution reste RESPONSABLE/ADMIN).
 * - RESPONSABLE : ses boutiques.
 * - ADMIN : toutes les boutiques actives.
 *
 * Le scope est porte exclusivement par `getAccessibleBoutiqueIds` qui
 * borne deja chaque role a son perimetre : pas de fuite cross-boutique.
 * Un viewer sans boutique accessible recoit une page vide.
 */
export async function listAlertesOuvertes({
  viewer,
  pagination,
}: ListAlertesOuvertesArgs): Promise<PaginatedResult<AlerteListItem>> {
  const accessible = await getAccessibleBoutiqueIds(viewer);
  if (accessible.length === 0) {
    return buildPaginated([], 0, pagination);
  }

  const where: Prisma.AlerteWhereInput = {
    status: AlerteStatus.OUVERTE,
    releve: { boutiqueId: { in: accessible } },
  };

  const skip = (pagination.page - 1) * pagination.pageSize;
  const [rows, total] = await Promise.all([
    db.alerte.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pagination.pageSize,
      select: ALERTE_LIST_SELECT,
    }),
    db.alerte.count({ where }),
  ]);
  const items = rows.map((row) => mapAlerteRow(row));
  return buildPaginated(items, total, pagination);
}

interface GetAlerteByIdArgs {
  readonly viewer: SessionUser;
  readonly alerteId: string;
}

/**
 * Recupere une alerte avec verification de scope boutique (lecture).
 *
 * Lecture ouverte aux trois roles : le SALARIE peut consulter une alerte
 * de SA boutique (un congelateur en alerte le concerne). La GESTION
 * (resolution) reste reservee RESPONSABLE/ADMIN cote `resolveAlerte`.
 *
 * - Scope : la liste `getAccessibleBoutiqueIds` borne deja le SALARIE a sa
 *   boutique, le RESPONSABLE a ses boutiques et l'ADMIN au parc. Si
 *   l'alerte pointe vers un releve d'une boutique non accessible au
 *   viewer, on remonte `NOT_FOUND` plutot que `FORBIDDEN` pour eviter une
 *   fuite d'existence (anti-enum).
 */
export async function getAlerteById({
  viewer,
  alerteId,
}: GetAlerteByIdArgs): Promise<Result<AlerteListItem, AlerteError>> {
  const alerte = await db.alerte.findUnique({
    where: { id: alerteId },
    select: ALERTE_LIST_SELECT,
  });
  if (!alerte) {
    return { success: false, error: 'NOT_FOUND' };
  }
  const accessible = await getAccessibleBoutiqueIds(viewer);
  if (!accessible.includes(alerte.releve.boutiqueId)) {
    return { success: false, error: 'NOT_FOUND' };
  }
  return {
    success: true,
    data: mapAlerteRow(alerte),
  };
}

// ===== US-ALE-002 : Resolution d'une alerte =====

interface ResolveAlerteArgs {
  readonly viewer: SessionUser;
  readonly alerteId: string;
  readonly commentaireResolution: string;
}

/**
 * Marque une alerte comme RESOLUE (US-ALE-002).
 *
 * Pipeline (defense en profondeur cote service) :
 *   1. Verifie le role via `canManageAlertes` (RESPONSABLE / ADMIN).
 *   2. Charge l'alerte (NOT_FOUND si introuvable).
 *   3. Verifie le scope boutique (NOT_FOUND si hors scope, anti-enum).
 *   4. Verifie le status courant (ALREADY_RESOLVED si deja non-OUVERTE).
 *   5. Update direct (mono-statement atomique) : status, resoluParId,
 *      resoluAt, commentaireResolution. Log applicatif pour tracabilite
 *      operationnelle (la ligne Alerte est l'audit metier).
 *
 * L'enum `AuditEntityType` Prisma ne couvre pas `ALERTE` : on log
 * via `logger.info` (Sentry/Loki en prod) - la tracabilite HACCP
 * est portee par les colonnes resoluParId/resoluAt/commentaire qui
 * restent immuables une fois passees a RESOLUE.
 */
export async function resolveAlerte({
  viewer,
  alerteId,
  commentaireResolution,
}: ResolveAlerteArgs): Promise<Result<{ readonly id: string }, AlerteError>> {
  if (!canManageAlertes(viewer)) {
    return { success: false, error: 'FORBIDDEN' };
  }

  const alerte = await db.alerte.findUnique({
    where: { id: alerteId },
    select: {
      id: true,
      status: true,
      releve: { select: { boutiqueId: true } },
    },
  });
  if (!alerte) {
    return { success: false, error: 'NOT_FOUND' };
  }

  const accessible = await getAccessibleBoutiqueIds(viewer);
  if (!accessible.includes(alerte.releve.boutiqueId)) {
    return { success: false, error: 'NOT_FOUND' };
  }
  if (alerte.status !== AlerteStatus.OUVERTE) {
    return { success: false, error: 'ALREADY_RESOLVED' };
  }

  // Mono-update : pas besoin de `$transaction` (un seul statement, atomique
  // par defaut). La defense vs concurrence est portee par le check
  // applicatif au-dessus + le fait que `status` ne revient pas a OUVERTE.
  const resoluAt = new Date();
  await db.alerte.update({
    where: { id: alerteId },
    data: {
      status: AlerteStatus.RESOLUE,
      resoluParId: viewer.id,
      resoluAt,
      commentaireResolution,
    },
  });

  logger.info('[alerte.resolve] alerte resolue', {
    alerteId,
    resoluParId: viewer.id,
    resoluAt: resoluAt.toISOString(),
  });

  return { success: true, data: { id: alerteId } };
}
