import { Prisma, type Creneau, type UserRole } from '@prisma/client';
import { db } from '@/lib/prisma';
import type { Result } from '@/types/result';
import type {
  ReleveAnnulationInput,
  ReleveCreateInput,
  ReleveHistoryQuery,
} from '@/lib/validations/releve';
import type { PaginatedResult, PaginationQuery } from '@/types/admin';
import type {
  ReleveAnnulationResult,
  ReleveCreatedResult,
  ReleveListItem,
  SaisieContext,
  TourneeCreneauInfo,
  TourneeEquipementCard,
} from '@/types/releve';
import {
  CRENEAU_ORDER,
  COMMENTAIRE_MIN_CHARS,
  DAYS_RECENT_HISTORY,
} from '@/lib/constants/releve';
import { computeReleveSignature } from '@/lib/signature';
import { buildPaginated } from '@/lib/utils/pagination';
import {
  getRecentDaysRange,
  isWithinRecentDays,
  parseISODateUtc,
  todayParisISO,
} from '@/lib/utils/dates';
import { createAlerte } from '@/lib/services/alerte.service';
import { getAccessibleBoutiqueIds } from '@/lib/permissions';

/**
 * Service Releve (Epic RELEVE, socle commun).
 *
 * Toutes les operations respectent :
 *   - immutabilite (RG-IMMU-001) : aucun UPDATE direct sur Releve hors
 *     set de `annuleParId` (autorise par le middleware Prisma).
 *   - tracabilite : signature SHA256 calculee serveur (RG-SIGN-001).
 *   - unicite releve actif (RG-CREN-001) : enforce par partial unique
 *     index SQL + check applicatif preventif.
 *   - alerte sur depassement seuils (RG-ALER-001) + commentaire
 *     obligatoire (RG-COMM-001).
 */

export type ReleveError =
  | 'EQUIPEMENT_NOT_FOUND'
  | 'EQUIPEMENT_INACTIVE'
  | 'BOUTIQUE_FORBIDDEN'
  | 'ALREADY_EXISTS'
  | 'COMMENTAIRE_REQUIRED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'ALREADY_CANCELLED'
  | 'INTERNAL_ERROR';

interface ViewerContext {
  readonly id: string;
  readonly role: UserRole;
}

type TxClient = Prisma.TransactionClient;

interface CreateReleveServiceInput extends ReleveCreateInput {
  readonly ip: string | null;
}

// ===== Helpers prives =====

function buildTourneeCreneaux(
  releves: readonly {
    readonly id: string;
    readonly creneau: Creneau;
    readonly temperature: number;
    readonly alerteHorsSeuils: boolean;
  }[]
): readonly TourneeCreneauInfo[] {
  const byCreneau = new Map<Creneau, (typeof releves)[number]>();
  for (const releve of releves) {
    byCreneau.set(releve.creneau, releve);
  }
  return CRENEAU_ORDER.map((creneau) => {
    const releve = byCreneau.get(creneau);
    if (!releve) {
      return {
        creneau,
        status: 'MISSING' as const,
        releveId: null,
        temperature: null,
        alerte: false,
      };
    }
    return {
      creneau,
      status: releve.alerteHorsSeuils ? ('ALERTE' as const) : ('DONE' as const),
      releveId: releve.id,
      temperature: releve.temperature,
      alerte: releve.alerteHorsSeuils,
    };
  });
}

// ===== US-REL-001 : Tournee du jour =====

interface ListTourneeArgs {
  readonly viewer: ViewerContext;
  readonly dateISO?: string;
  readonly boutiqueId?: string;
}

/**
 * Recupere la liste des cartes equipement avec status des 3 creneaux
 * du jour, pour la tournee du salarie (US-REL-001).
 *
 * Filtre par boutique selon le role :
 *   - SALARIE : sa boutique unique (boutiqueSalarieId)
 *   - RESPONSABLE : ses boutiques (jointure BoutiqueUser)
 *   - ADMIN : toutes les boutiques actives
 */
export async function listTournee({
  viewer,
  dateISO,
  boutiqueId,
}: ListTourneeArgs): Promise<readonly TourneeEquipementCard[]> {
  // RG-LECT-001 : un SALARIE ne peut consulter qu'une tournee dans la
  // fenetre `DAYS_RECENT_HISTORY` (7j). RESPONSABLE/ADMIN gardent l'acces
  // complet (use-case audit historique). Fallback vide = symetrique avec
  // "scope vide" (le caller affiche un etat "aucune tournee").
  if (
    viewer.role === 'SALARIE' &&
    dateISO &&
    !isWithinRecentDays(dateISO, DAYS_RECENT_HISTORY)
  ) {
    return [];
  }

  const accessible = await getAccessibleBoutiqueIds(viewer);
  if (accessible.length === 0) {
    return [];
  }
  const scopedBoutiqueIds =
    boutiqueId && accessible.includes(boutiqueId)
      ? [boutiqueId]
      : [...accessible];
  if (scopedBoutiqueIds.length === 0) {
    return [];
  }

  const date = parseISODateUtc(dateISO ?? todayParisISO());

  const equipements = await db.equipement.findMany({
    where: {
      actif: true,
      boutiqueId: { in: scopedBoutiqueIds },
    },
    orderBy: [{ boutique: { nom: 'asc' } }, { nom: 'asc' }],
    include: {
      boutique: { select: { id: true, nom: true } },
      releves: {
        where: { date, annuleParId: null },
        select: {
          id: true,
          creneau: true,
          temperature: true,
          alerteHorsSeuils: true,
        },
      },
    },
  });

  return equipements.map((equipement) => ({
    equipementId: equipement.id,
    equipementNom: equipement.nom,
    type: equipement.type,
    seuilMin: equipement.seuilMin,
    seuilMax: equipement.seuilMax,
    boutiqueId: equipement.boutique.id,
    boutiqueNom: equipement.boutique.nom,
    creneaux: buildTourneeCreneaux(equipement.releves),
  }));
}

// ===== US-REL-002 : Saisie context =====

interface GetSaisieContextArgs {
  readonly viewer: ViewerContext;
  readonly equipementId: string;
  readonly creneau: Creneau;
  readonly dateISO?: string;
  /**
   * Optimisation : si le caller dispose deja des boutiqueIds en session
   * (JWT), il peut les passer ici pour court-circuiter un round-trip
   * Prisma. Sans valeur, fallback sur `getAccessibleBoutiqueIds`.
   */
  readonly viewerBoutiqueIds?: readonly string[];
}

/**
 * Fournit le contexte (equipement + seuils + creneau + date) pour le
 * formulaire de saisie. Verifie en une seule passe :
 *   - existence equipement
 *   - equipement actif
 *   - boutique accessible au viewer
 *   - aucun releve actif deja sur ce (equipement, date, creneau)
 */
export async function getSaisieContext({
  viewer,
  equipementId,
  creneau,
  dateISO,
  viewerBoutiqueIds,
}: GetSaisieContextArgs): Promise<Result<SaisieContext, ReleveError>> {
  const accessible =
    viewerBoutiqueIds ?? (await getAccessibleBoutiqueIds(viewer));
  const targetDateISO = dateISO ?? todayParisISO();
  const date = parseISODateUtc(targetDateISO);

  const equipement = await db.equipement.findUnique({
    where: { id: equipementId },
    include: {
      boutique: { select: { id: true, nom: true } },
      releves: {
        where: { date, creneau, annuleParId: null },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!equipement) {
    return { success: false, error: 'EQUIPEMENT_NOT_FOUND' };
  }
  if (!equipement.actif) {
    return { success: false, error: 'EQUIPEMENT_INACTIVE' };
  }
  if (!accessible.includes(equipement.boutique.id)) {
    return { success: false, error: 'BOUTIQUE_FORBIDDEN' };
  }
  if (equipement.releves.length > 0) {
    return { success: false, error: 'ALREADY_EXISTS' };
  }

  return {
    success: true,
    data: {
      equipement: {
        id: equipement.id,
        nom: equipement.nom,
        type: equipement.type,
        seuilMin: equipement.seuilMin,
        seuilMax: equipement.seuilMax,
        boutiqueId: equipement.boutique.id,
        boutiqueNom: equipement.boutique.nom,
      },
      creneau,
      dateISO: targetDateISO,
    },
  };
}

// ===== US-REL-002 : Creation releve =====

function isHorsSeuils(
  temperature: number,
  seuilMin: number,
  seuilMax: number
): boolean {
  return temperature < seuilMin || temperature > seuilMax;
}

interface InsertReleveArgs {
  readonly tx: TxClient;
  readonly input: CreateReleveServiceInput;
  readonly viewerId: string;
  readonly equipement: {
    readonly id: string;
    readonly boutiqueId: string;
    readonly seuilMin: number;
    readonly seuilMax: number;
  };
  readonly date: Date;
  readonly serverTimestamp: Date;
}

interface InsertReleveResult {
  readonly id: string;
  readonly alerteHorsSeuils: boolean;
}

async function insertReleve({
  tx,
  input,
  viewerId,
  equipement,
  date,
  serverTimestamp,
}: InsertReleveArgs): Promise<InsertReleveResult> {
  const alerteHorsSeuils = isHorsSeuils(
    input.temperature,
    equipement.seuilMin,
    equipement.seuilMax
  );
  const signature = computeReleveSignature({
    userId: viewerId,
    serverTimestamp,
    ip: input.ip,
    equipementId: equipement.id,
    creneau: input.creneau,
    temperature: input.temperature,
    commentaire: input.commentaire ?? null,
  });

  const releve = await tx.releve.create({
    data: {
      date,
      creneau: input.creneau,
      temperature: input.temperature,
      commentaire: input.commentaire ?? null,
      alerteHorsSeuils,
      signature,
      ip: input.ip,
      equipementId: equipement.id,
      boutiqueId: equipement.boutiqueId,
      userId: viewerId,
    },
    select: { id: true },
  });
  return { id: releve.id, alerteHorsSeuils };
}

interface CreateReleveArgs {
  readonly viewer: ViewerContext;
  readonly input: CreateReleveServiceInput;
  /**
   * Optimisation : si le caller dispose deja des boutiqueIds en session
   * (JWT), il peut les passer ici pour court-circuiter un round-trip
   * Prisma. Sans valeur, fallback sur `getAccessibleBoutiqueIds`.
   */
  readonly viewerBoutiqueIds?: readonly string[];
}

/**
 * Cree un releve (US-REL-002) de maniere atomique :
 *   1. Verifie permissions + equipement actif + non-double-saisie
 *   2. Verifie commentaire si hors seuils
 *   3. Insert Releve + signature + alerte (si hors seuils)
 *
 * L'envoi email d'alerte est volontairement HORS de cette fonction
 * (fire-and-forget cote caller via `after()`, decision #2). Le caller
 * recoit `alerteCreated`/`alerteId` pour declencher l'email.
 */
export async function createReleve({
  viewer,
  input,
  viewerBoutiqueIds,
}: CreateReleveArgs): Promise<Result<ReleveCreatedResult, ReleveError>> {
  const accessible =
    viewerBoutiqueIds ?? (await getAccessibleBoutiqueIds(viewer));
  const equipement = await db.equipement.findUnique({
    where: { id: input.equipementId },
    select: {
      id: true,
      actif: true,
      boutiqueId: true,
      seuilMin: true,
      seuilMax: true,
    },
  });
  if (!equipement) {
    return { success: false, error: 'EQUIPEMENT_NOT_FOUND' };
  }
  if (!equipement.actif) {
    return { success: false, error: 'EQUIPEMENT_INACTIVE' };
  }
  if (!accessible.includes(equipement.boutiqueId)) {
    return { success: false, error: 'BOUTIQUE_FORBIDDEN' };
  }

  const alerteHorsSeuils = isHorsSeuils(
    input.temperature,
    equipement.seuilMin,
    equipement.seuilMax
  );
  if (
    alerteHorsSeuils &&
    (!input.commentaire || input.commentaire.length < COMMENTAIRE_MIN_CHARS)
  ) {
    return { success: false, error: 'COMMENTAIRE_REQUIRED' };
  }

  const serverTimestamp = new Date();
  const date = parseISODateUtc(todayParisISO(serverTimestamp));

  try {
    const result = await db.$transaction(async (tx) => {
      const inserted = await insertReleve({
        tx: tx as unknown as TxClient,
        input,
        viewerId: viewer.id,
        equipement,
        date,
        serverTimestamp,
      });

      if (!inserted.alerteHorsSeuils) {
        return {
          releveId: inserted.id,
          alerteCreated: false,
          alerteId: null,
        } satisfies ReleveCreatedResult;
      }
      const alerte = await createAlerte({
        releveId: inserted.id,
        tx: tx as unknown as Parameters<typeof createAlerte>[0]['tx'],
      });
      return {
        releveId: inserted.id,
        alerteCreated: true,
        alerteId: alerte.id,
      } satisfies ReleveCreatedResult;
    });
    return { success: true, data: result };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return { success: false, error: 'ALREADY_EXISTS' };
    }
    return { success: false, error: 'INTERNAL_ERROR' };
  }
}

// ===== US-REL-003 : Historique recent salarie =====

interface ReleveDbRow {
  readonly id: string;
  readonly date: Date;
  readonly creneau: Creneau;
  readonly temperature: number;
  readonly alerteHorsSeuils: boolean;
  readonly commentaire: string | null;
  readonly motifAnnulation: string | null;
  readonly createdAt: Date;
  readonly equipementId: string;
  readonly equipement: {
    readonly nom: string;
    readonly type: import('@prisma/client').TypeEquipement;
  };
  readonly boutiqueId: string;
  readonly boutique: { readonly nom: string };
  readonly user: { readonly email: string; readonly name: string };
  readonly annule: {
    readonly id: string;
    readonly motifAnnulation: string | null;
  } | null;
}

function mapReleveRow(
  row: ReleveDbRow,
  options: { readonly exposeSalarie: boolean }
): ReleveListItem {
  // N-2 : sur un releve ORIGINAL annule, `row.motifAnnulation` est null
  // (le motif est porte par la ligne d'ANNULATION, qui pointe vers
  // l'original via la relation `annule`). On expose le motif depuis la
  // relation si dispo : audit DDPP veut voir le motif sur l'original.
  // Pour la ligne d'annulation elle-meme, on retombe sur son propre
  // `motifAnnulation` (porte directement).
  return {
    id: row.id,
    date: row.date,
    creneau: row.creneau,
    temperature: row.temperature,
    alerteHorsSeuils: row.alerteHorsSeuils,
    commentaire: row.commentaire,
    equipementId: row.equipementId,
    equipementNom: row.equipement.nom,
    equipementType: row.equipement.type,
    boutiqueId: row.boutiqueId,
    boutiqueNom: row.boutique.nom,
    salarieEmail: options.exposeSalarie ? row.user.email : null,
    salarieName: options.exposeSalarie ? row.user.name : null,
    annule: row.annule !== null,
    annuleParReleveId: row.annule?.id ?? null,
    motifAnnulation: row.annule?.motifAnnulation ?? row.motifAnnulation,
    createdAt: row.createdAt,
  };
}

const RELEVE_LIST_INCLUDE = {
  equipement: { select: { nom: true, type: true } },
  boutique: { select: { nom: true } },
  user: { select: { email: true, name: true } },
  annule: { select: { id: true, motifAnnulation: true } },
} as const;

interface ListRecentsArgs {
  readonly viewer: ViewerContext;
  readonly query: ReleveHistoryQuery;
}

/**
 * Liste paginee des releves recents du salarie connecte
 * (US-REL-003, fenetre `DAYS_RECENT_HISTORY` glissante).
 * Inclut les annules (visibilite historique).
 */
export async function listRecentsBySalarie({
  viewer,
  query,
}: ListRecentsArgs): Promise<PaginatedResult<ReleveListItem>> {
  const { from, to } = getRecentDaysRange(DAYS_RECENT_HISTORY);
  const where: Prisma.ReleveWhereInput = {
    userId: viewer.id,
    date: { gte: from, lte: to },
    ...(query.equipementId ? { equipementId: query.equipementId } : {}),
  };
  const paginationQuery: PaginationQuery = {
    page: query.page,
    pageSize: query.pageSize,
  };
  const skip = (paginationQuery.page - 1) * paginationQuery.pageSize;
  const [rows, total] = await Promise.all([
    db.releve.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: paginationQuery.pageSize,
      include: RELEVE_LIST_INCLUDE,
    }),
    db.releve.count({ where }),
  ]);
  const items = rows.map((row) =>
    mapReleveRow(row as ReleveDbRow, { exposeSalarie: false })
  );
  return buildPaginated(items, total, paginationQuery);
}

// ===== Lecture unitaire (permissions consolidees) =====

interface GetReleveByIdArgs {
  readonly viewer: ViewerContext;
  readonly releveId: string;
}

/**
 * Recupere un releve avec verification fine des permissions :
 *   - SALARIE : doit etre l'auteur OU sur sa boutique de rattachement
 *   - RESPONSABLE : releve sur une de ses boutiques
 *   - ADMIN : toujours autorise
 */
export async function getReleveById({
  viewer,
  releveId,
}: GetReleveByIdArgs): Promise<Result<ReleveListItem, ReleveError>> {
  const releve = await db.releve.findUnique({
    where: { id: releveId },
    include: RELEVE_LIST_INCLUDE,
  });
  if (!releve) {
    return { success: false, error: 'NOT_FOUND' };
  }
  const accessible = await getAccessibleBoutiqueIds(viewer);
  const isAuthor = releve.userId === viewer.id;
  const inScope = accessible.includes(releve.boutiqueId);
  if (!isAuthor && !inScope) {
    return { success: false, error: 'FORBIDDEN' };
  }
  const exposeSalarie = viewer.role !== 'SALARIE';
  return {
    success: true,
    data: mapReleveRow(releve as ReleveDbRow, { exposeSalarie }),
  };
}

// ===== US-REL-004 : Annulation =====

interface AnnulerReleveArgs {
  readonly viewer: ViewerContext;
  readonly input: ReleveAnnulationInput;
  readonly ip: string | null;
}

/**
 * Annule un releve (US-REL-004), avec remplacement optionnel.
 *
 * Atomicite (1 seule transaction) :
 *   1. Lock + verifie le releve original (NOT_FOUND/ALREADY_CANCELLED)
 *   2. Verifie permissions sur la boutique du releve
 *   3. Cree le releve "annulation" (temperature copiee de l'original,
 *      motif renseigne, signature recalculee, alerteHorsSeuils copiee)
 *   4. UPDATE l'original pour set `annuleParId` (autorise par
 *      middleware Prisma car seule colonne whitelistee).
 *   5. Si replacement fourni : cree un second releve actif avec la
 *      vraie valeur. La contrainte unique (partial) accepte car le
 *      premier vient d'etre marque annule.
 */
export async function annulerReleve({
  viewer,
  input,
  ip,
}: AnnulerReleveArgs): Promise<Result<ReleveAnnulationResult, ReleveError>> {
  if (viewer.role !== 'RESPONSABLE' && viewer.role !== 'ADMIN') {
    return { success: false, error: 'FORBIDDEN' };
  }
  const accessible = await getAccessibleBoutiqueIds(viewer);
  const serverTimestamp = new Date();

  try {
    const result = await db.$transaction(async (tx) => {
      const original = await tx.releve.findUnique({
        where: { id: input.releveId },
        select: {
          id: true,
          date: true,
          creneau: true,
          temperature: true,
          alerteHorsSeuils: true,
          equipementId: true,
          boutiqueId: true,
          annuleParId: true,
          equipement: { select: { seuilMin: true, seuilMax: true } },
        },
      });
      if (!original) {
        throw new ReleveServiceError('NOT_FOUND');
      }
      if (original.annuleParId !== null) {
        throw new ReleveServiceError('ALREADY_CANCELLED');
      }
      if (!accessible.includes(original.boutiqueId)) {
        throw new ReleveServiceError('FORBIDDEN');
      }

      // Verifie l'alerte du replacement AVANT d'inserer quoi que ce soit
      // (integrite HACCP, RG-ALER-001) : un responsable ne peut pas
      // "blanchir" une temperature dangereuse en l'inserant comme remplacement.
      const replacementAlerte = input.replacement
        ? isHorsSeuils(
            input.replacement.temperature,
            original.equipement.seuilMin,
            original.equipement.seuilMax
          )
        : false;
      if (
        input.replacement &&
        replacementAlerte &&
        (!input.replacement.commentaire ||
          input.replacement.commentaire.length < COMMENTAIRE_MIN_CHARS)
      ) {
        throw new ReleveServiceError('COMMENTAIRE_REQUIRED');
      }

      // N-1 : la signature doit refleter EXACTEMENT les valeurs stockees
      // pour que `verifyReleveSignature` round-trip avec succes.
      // Or la ligne d'annulation a `commentaire: null` (le motif est
      // stocke dans `motifAnnulation`, colonne distincte). On passe donc
      // `commentaire: null` ici. Le motif n'est pas couvert par la
      // signature, mais il est immuable de toute facon (le middleware
      // Prisma whitelist uniquement `annuleParId` sur UPDATE).
      const annulationSignature = computeReleveSignature({
        userId: viewer.id,
        serverTimestamp,
        ip,
        equipementId: original.equipementId,
        creneau: original.creneau,
        temperature: original.temperature,
        commentaire: null,
      });

      // 1. Cree le releve "annulation" (porte le motif).
      const annulation = await (tx as unknown as TxClient).releve.create({
        data: {
          date: original.date,
          creneau: original.creneau,
          temperature: original.temperature,
          commentaire: null,
          alerteHorsSeuils: original.alerteHorsSeuils,
          signature: annulationSignature,
          ip,
          motifAnnulation: input.motif,
          equipementId: original.equipementId,
          boutiqueId: original.boutiqueId,
          userId: viewer.id,
          // L'annulation pointe vers l'original via annule (relation
          // inverse). On laisse annuleParId null sur la nouvelle ligne.
        },
        select: { id: true },
      });

      // 2. Lie l'original a l'annulation (set annuleParId, one-way).
      await tx.releve.update({
        where: { id: original.id },
        data: { annuleParId: annulation.id },
      });

      // 3. Cree le remplacement optionnel (vraie valeur).
      let replacementReleveId: string | null = null;
      let replacementAlerteId: string | null = null;
      if (input.replacement) {
        const replacementSignature = computeReleveSignature({
          userId: viewer.id,
          serverTimestamp,
          ip,
          equipementId: original.equipementId,
          creneau: original.creneau,
          temperature: input.replacement.temperature,
          commentaire: input.replacement.commentaire ?? null,
        });
        const replacement = await (tx as unknown as TxClient).releve.create({
          data: {
            date: original.date,
            creneau: original.creneau,
            temperature: input.replacement.temperature,
            commentaire: input.replacement.commentaire ?? null,
            alerteHorsSeuils: replacementAlerte,
            signature: replacementSignature,
            ip,
            equipementId: original.equipementId,
            boutiqueId: original.boutiqueId,
            userId: viewer.id,
          },
          select: { id: true },
        });
        replacementReleveId = replacement.id;

        // Si le replacement est lui-meme hors seuils, l'alerte HACCP
        // associee est creee DANS la meme transaction (RG-ALER-001) :
        // l'integrite est preservee meme en cas d'echec ulterieur.
        // On expose l'id au caller (M-1) pour dispatch email post-commit
        // (le service ne fait pas de side-effect reseau, decision #2).
        if (replacementAlerte) {
          const alerte = await createAlerte({
            releveId: replacement.id,
            tx: tx as unknown as Parameters<typeof createAlerte>[0]['tx'],
          });
          replacementAlerteId = alerte.id;
        }
      }

      return {
        annulationReleveId: annulation.id,
        replacementReleveId,
        replacementAlerteId,
      } satisfies ReleveAnnulationResult;
    });
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof ReleveServiceError) {
      return { success: false, error: error.code };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return { success: false, error: 'ALREADY_EXISTS' };
    }
    return { success: false, error: 'INTERNAL_ERROR' };
  }
}

/**
 * Erreur metier interne au service Releve, levee depuis l'interieur
 * d'une transaction pour declencher le rollback automatique tout en
 * preservant le code d'erreur typed dans le `catch` exterieur.
 */
class ReleveServiceError extends Error {
  constructor(public readonly code: ReleveError) {
    super(code);
    this.name = 'ReleveServiceError';
  }
}
