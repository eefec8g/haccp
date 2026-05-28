import type { Creneau } from '@prisma/client';
import { db } from '@/lib/prisma';
import { getAccessibleBoutiqueIds, type SessionUser } from '@/lib/permissions';
import { parseISODateUtc, todayParisISO } from '@/lib/utils/dates';
import { logger } from '@/lib/logger';
import type { Result } from '@/types/result';
import type {
  TourneeEquipement,
  TourneeError,
  TourneeReleve,
  TourneeSignature,
  TourneeStatus,
} from '@/types/tournee';

/**
 * Service tournee guidee (feat/tournee-guidee).
 *
 * Responsabilites :
 *   - `loadTourneeStatus` : charge en une passe les equipements actifs
 *     d'une boutique, les releves actifs du jour pour un creneau donne
 *     et la signature eventuelle du registre (boutique + dateISO).
 *
 * Defense en profondeur : meme si la page valide le scope, le service
 * verifie via `getAccessibleBoutiqueIds` qu'on n'expose que les
 * boutiques accessibles au viewer.
 *
 * Performance :
 *   - 1 query equipements + 1 query releves + 1 query signature en
 *     parallele (`Promise.all`). Pas de N+1 (les releves sont
 *     recuperes en bulk + indexes en memoire).
 */

interface LoadTourneeStatusArgs {
  readonly viewer: SessionUser;
  readonly creneau: Creneau;
  readonly dateISO?: string;
  /**
   * Optionnel : si fourni, doit appartenir aux boutiques accessibles
   * du viewer (sinon FORBIDDEN).
   *
   * - SALARIE     : ignore (toujours sa boutique unique).
   * - RESPONSABLE : doit etre fourni si plusieurs boutiques accessibles,
   *                 sinon `BOUTIQUE_NOT_FOUND`.
   * - ADMIN       : doit etre fourni (l'admin voit toutes les boutiques,
   *                 il ne peut pas faire une "tournee" sur tout le parc).
   */
  readonly boutiqueId?: string;
}

interface ResolvedBoutique {
  readonly id: string;
}

async function resolveTargetBoutique(
  viewer: SessionUser,
  boutiqueId: string | undefined
): Promise<Result<ResolvedBoutique, TourneeError>> {
  const accessible = await getAccessibleBoutiqueIds(viewer);
  if (accessible.length === 0) {
    return { success: false, error: 'BOUTIQUE_NOT_FOUND' };
  }
  if (boutiqueId) {
    if (!accessible.includes(boutiqueId)) {
      return { success: false, error: 'FORBIDDEN' };
    }
    return { success: true, data: { id: boutiqueId } };
  }
  const [unique] = accessible;
  if (accessible.length === 1 && unique) {
    return { success: true, data: { id: unique } };
  }
  return { success: false, error: 'BOUTIQUE_NOT_FOUND' };
}

interface BoutiqueRow {
  readonly id: string;
  readonly nom: string;
}

async function getBoutiqueOrError(
  boutiqueId: string
): Promise<Result<BoutiqueRow, TourneeError>> {
  const boutique = await db.boutique.findUnique({
    where: { id: boutiqueId },
    select: { id: true, nom: true, actif: true },
  });
  if (!boutique || !boutique.actif) {
    return { success: false, error: 'BOUTIQUE_NOT_FOUND' };
  }
  return { success: true, data: { id: boutique.id, nom: boutique.nom } };
}

interface EquipementRow {
  readonly id: string;
  readonly nom: string;
  readonly seuilMin: number;
  readonly seuilMax: number;
}

interface ReleveRow {
  readonly id: string;
  readonly equipementId: string;
  readonly temperature: number;
  readonly alerteHorsSeuils: boolean;
  readonly createdAt: Date;
}

interface SignatureRow {
  readonly id: string;
  readonly signedAt: Date;
  readonly signataireRoleSnapshot: TourneeSignature['signataireRoleSnapshot'];
  readonly signataire: { readonly name: string };
}

interface FetchPayloadArgs {
  readonly boutiqueId: string;
  readonly date: Date;
  readonly creneau: Creneau;
  readonly dateISO: string;
}

interface FetchedPayload {
  readonly equipements: readonly EquipementRow[];
  readonly releves: readonly ReleveRow[];
  readonly signature: SignatureRow | null;
}

async function fetchTourneePayload(
  args: FetchPayloadArgs
): Promise<FetchedPayload> {
  const [equipements, releves, signature] = await Promise.all([
    db.equipement.findMany({
      where: { actif: true, boutiqueId: args.boutiqueId },
      orderBy: { nom: 'asc' },
      select: { id: true, nom: true, seuilMin: true, seuilMax: true },
    }),
    db.releve.findMany({
      where: {
        date: args.date,
        creneau: args.creneau,
        annuleParId: null,
        boutiqueId: args.boutiqueId,
      },
      select: {
        id: true,
        equipementId: true,
        temperature: true,
        alerteHorsSeuils: true,
        createdAt: true,
      },
    }),
    db.signature.findUnique({
      where: {
        boutiqueId_dateISO: {
          boutiqueId: args.boutiqueId,
          dateISO: args.dateISO,
        },
      },
      select: {
        id: true,
        signedAt: true,
        signataireRoleSnapshot: true,
        signataire: { select: { name: true } },
      },
    }),
  ]);
  return { equipements, releves, signature };
}

function indexRelevesByEquipement(
  rows: readonly ReleveRow[]
): Readonly<Record<string, TourneeReleve>> {
  const map: Record<string, TourneeReleve> = {};
  for (const row of rows) {
    map[row.equipementId] = {
      id: row.id,
      temperature: row.temperature,
      alerteHorsSeuils: row.alerteHorsSeuils,
      saisiAt: row.createdAt,
    };
  }
  return map;
}

function buildRelevesByEquipement({
  equipements,
  byEquipement,
}: {
  readonly equipements: readonly EquipementRow[];
  readonly byEquipement: Readonly<Record<string, TourneeReleve>>;
}): Readonly<Record<string, TourneeReleve | null>> {
  const result: Record<string, TourneeReleve | null> = {};
  for (const equipement of equipements) {
    result[equipement.id] = byEquipement[equipement.id] ?? null;
  }
  return result;
}

function mapSignature(row: SignatureRow | null): TourneeSignature | null {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    signedAt: row.signedAt,
    signataireNom: row.signataire.name,
    signataireRoleSnapshot: row.signataireRoleSnapshot,
  };
}

function toTourneeEquipement(row: EquipementRow): TourneeEquipement {
  return {
    id: row.id,
    nom: row.nom,
    seuilMin: row.seuilMin,
    seuilMax: row.seuilMax,
  };
}

interface BuildStatusArgs {
  readonly dateISO: string;
  readonly creneau: Creneau;
  readonly boutique: BoutiqueRow;
  readonly payload: FetchedPayload;
}

function buildStatus({
  dateISO,
  creneau,
  boutique,
  payload,
}: BuildStatusArgs): TourneeStatus {
  const equipements = payload.equipements.map(toTourneeEquipement);
  const byEquipement = indexRelevesByEquipement(payload.releves);
  return {
    dateISO,
    creneau,
    boutiqueId: boutique.id,
    boutiqueNom: boutique.nom,
    equipements,
    releves: buildRelevesByEquipement({
      equipements: payload.equipements,
      byEquipement,
    }),
    signature: mapSignature(payload.signature),
  };
}

/**
 * Charge le statut complet de la tournee guidee pour un creneau donne.
 *
 * Pipeline :
 *   1. Resout la boutique cible (scope viewer + boutiqueId optionnel).
 *   2. Verifie que la boutique est active.
 *   3. Fetch equipements + releves actifs du jour + signature en parallele.
 *   4. Construit le status projete (indexation O(1) cote client).
 *
 * Erreurs :
 *   - BOUTIQUE_NOT_FOUND : viewer sans scope, ou multi-boutiques sans
 *     selection, ou boutique inactive.
 *   - FORBIDDEN          : boutiqueId fourni hors scope.
 *   - INTERNAL           : erreur DB non recuperable (loggee).
 */
export async function loadTourneeStatus(
  args: LoadTourneeStatusArgs
): Promise<Result<TourneeStatus, TourneeError>> {
  const dateISO = args.dateISO ?? todayParisISO();
  try {
    const resolved = await resolveTargetBoutique(args.viewer, args.boutiqueId);
    if (!resolved.success) {
      return resolved;
    }
    const boutique = await getBoutiqueOrError(resolved.data.id);
    if (!boutique.success) {
      return boutique;
    }
    const payload = await fetchTourneePayload({
      boutiqueId: boutique.data.id,
      date: parseISODateUtc(dateISO),
      creneau: args.creneau,
      dateISO,
    });
    return {
      success: true,
      data: buildStatus({
        dateISO,
        creneau: args.creneau,
        boutique: boutique.data,
        payload,
      }),
    };
  } catch (error) {
    logger.error('[tournee.service] loadTourneeStatus failed', {
      viewerId: args.viewer.id,
      creneau: args.creneau,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return { success: false, error: 'INTERNAL' };
  }
}
