import type { Creneau } from '@prisma/client';
import { db } from '@/lib/prisma';
import {
  canExport,
  getAccessibleBoutiqueIds,
  type SessionUser,
} from '@/lib/permissions';
import {
  MILLIS_PER_DAY,
  daysInclusive,
  isoFromDate,
  parseISODateUtc,
  todayParisISO,
} from '@/lib/utils/dates';
import { dateDebutEffective } from '@/lib/utils/date-debut';
import { CRENEAU_ORDER } from '@/lib/constants/releve';
import {
  HARD_LIMIT_RELEVES,
  MAX_PERIODE_DAYS,
} from '@/lib/constants/releve-listing';
import { logger } from '@/lib/logger';
import type { Result } from '@/types/result';
import type {
  ReleveListingError,
  ReleveListingItem,
  ReleveListingQuery,
  ReleveListingResult,
  ReleveListingStats,
  ReleveListingStatut,
} from '@/types/releve-listing';

/**
 * Service `releve-listing` (Epic LISTING -- Phase 1).
 *
 * Responsabilites :
 *   - `listRelevesForListing` : agrege releves + manquants virtuels +
 *     releves annules sur une periode `[dateStart, dateEnd]` pour
 *     consommation par la page de consultation interactive
 *     RESPONSABLE/ADMIN (Phase 2).
 *
 * Securite (RG-PERM-001) :
 *   - `canExport(viewer)` -> FORBIDDEN sinon (SALARIE exclu : il a
 *     deja sa page historique limitee a ses propres releves 7j).
 *   - Scope strict via `getAccessibleBoutiqueIds`. Si la query specifie
 *     `boutiqueId` ou `equipementId`, on verifie qu'ils appartiennent
 *     au scope (sinon BOUTIQUE_NOT_FOUND / EQUIPEMENT_NOT_FOUND, anti-enum).
 *
 * Performance :
 *   - 2 queries paralleles (equipements + releves), agregation memoire.
 *   - Volume cible nominal RESPONSABLE : 92 jours x 5 boutiques x 5
 *     equipements x 3 creneaux = 6 900 cellules + ~7 000 releves --
 *     RAM OK sur Vercel Hobby (256MB).
 *   - Worst-case ADMIN multi-tenant : 92 jours x 100 boutiques x 500
 *     equipements x 3 creneaux ~= 138 000 cellules, et autant de releves
 *     actifs + jusqu'a N releves annules. Pour borner la consommation
 *     memoire on applique `take: HARD_LIMIT_RELEVES + 1` cote DB (le `+1`
 *     detecte l'overflow, voir code erreur `TOO_MANY_RESULTS`).
 *   - Pas de N+1 : pas de jointure dans la boucle.
 *
 * Architecture interne (chaque etape isolee en helper SRP <20L) :
 *   1. Guard `canExport`.
 *   2. `validateListingScope` -- resolve boutiques + verifie equipement.
 *   3. `validateListingPeriode` -- defense en profondeur cote service.
 *   4. `loadListingData` -- 2 queries paralleles.
 *   5. `aggregateListingItems` -- jours x equipements x creneaux + annules.
 *   6. `applyStatusFilter` -- filtre `statut` apres aggregation.
 *   7. `computeListingStats` -- stats sur l'ensemble (avant pagination).
 *   8. `paginateItems` -- slice par page/pageSize.
 */

interface ListRelevesForListingArgs {
  readonly viewer: SessionUser;
  readonly query: ReleveListingQuery;
}

export async function listRelevesForListing(
  args: ListRelevesForListingArgs
): Promise<Result<ReleveListingResult, ReleveListingError>> {
  if (!canExport(args.viewer)) {
    return { success: false, error: 'FORBIDDEN' };
  }
  const periodeCheck = validateListingPeriode(args.query);
  if (!periodeCheck.success) {
    return periodeCheck;
  }
  const scope = await validateListingScope({
    viewer: args.viewer,
    query: args.query,
  });
  if (!scope.success) {
    return scope;
  }
  return runListingWithLogging({ ...args, boutiqueIds: scope.data });
}

interface RunListingArgs extends ListRelevesForListingArgs {
  readonly boutiqueIds: readonly string[];
}

async function runListingWithLogging(
  args: RunListingArgs
): Promise<Result<ReleveListingResult, ReleveListingError>> {
  try {
    return await assembleListing({
      query: args.query,
      boutiqueIds: args.boutiqueIds,
    });
  } catch (error) {
    // Ne JAMAIS logger `error.message` brut : un message Prisma peut
    // contenir un fragment SQL avec des valeurs (PII / IDs internes).
    // On log uniquement le nom du type d'erreur + le code Prisma si
    // disponible, ce qui est suffisant pour trier en supervision.
    logger.error('[releve-listing.service] aggregation failed', {
      viewerId: args.viewer.id,
      dateStart: args.query.dateStart,
      dateEnd: args.query.dateEnd,
      errorName: error instanceof Error ? error.name : 'unknown',
      errorCode: (error as { code?: string })?.code,
    });
    return { success: false, error: 'INTERNAL' };
  }
}

/**
 * Valide la periode `[dateStart, dateEnd]` (defense en profondeur cote
 * service -- Zod l'a deja fait, on rejoue pour les appels depuis tests
 * et scripts ad hoc).
 */
function validateListingPeriode(
  query: ReleveListingQuery
): Result<true, ReleveListingError> {
  if (query.dateEnd < query.dateStart) {
    return { success: false, error: 'PERIODE_INVALID' };
  }
  if (daysInclusive(query.dateStart, query.dateEnd) > MAX_PERIODE_DAYS) {
    return { success: false, error: 'PERIODE_TOO_LARGE' };
  }
  if (query.dateEnd > todayParisISO()) {
    return { success: false, error: 'PERIODE_IN_FUTURE' };
  }
  return { success: true, data: true };
}

interface ValidateScopeArgs {
  readonly viewer: SessionUser;
  readonly query: ReleveListingQuery;
}

/**
 * Resout le scope boutiques + verifie l'appartenance equipementId.
 *
 * - Si `boutiqueId` fourni : il doit etre dans le scope viewer
 *   (`BOUTIQUE_NOT_FOUND` sinon, anti-enum).
 * - Si `equipementId` fourni : il doit appartenir a une boutique du scope
 *   (`EQUIPEMENT_NOT_FOUND` sinon, anti-enum).
 */
async function validateListingScope(
  args: ValidateScopeArgs
): Promise<Result<readonly string[], ReleveListingError>> {
  const accessible = await getAccessibleBoutiqueIds(args.viewer);
  if (args.query.boutiqueId && !accessible.includes(args.query.boutiqueId)) {
    return { success: false, error: 'BOUTIQUE_NOT_FOUND' };
  }
  const boutiqueIds = args.query.boutiqueId
    ? [args.query.boutiqueId]
    : [...accessible];
  if (args.query.equipementId) {
    const equipement = await db.equipement.findFirst({
      where: {
        id: args.query.equipementId,
        boutiqueId: { in: boutiqueIds },
      },
      select: { id: true },
    });
    if (!equipement) {
      return { success: false, error: 'EQUIPEMENT_NOT_FOUND' };
    }
  }
  return { success: true, data: boutiqueIds };
}

interface AssembleArgs {
  readonly query: ReleveListingQuery;
  readonly boutiqueIds: readonly string[];
}

async function assembleListing(
  args: AssembleArgs
): Promise<Result<ReleveListingResult, ReleveListingError>> {
  if (args.boutiqueIds.length === 0) {
    return { success: true, data: buildEmptyListingResult(args.query) };
  }
  const loaded = await loadListingData(args);
  if (loaded.releves.length > HARD_LIMIT_RELEVES) {
    return { success: false, error: 'TOO_MANY_RESULTS' };
  }
  const jours = enumerateIsoDays(args.query.dateStart, args.query.dateEnd);
  const allItems = aggregateListingItems({
    jours,
    equipements: loaded.equipements,
    releves: loaded.releves,
    creneauFilter: args.query.creneau,
  });
  const filteredItems = applyStatusFilter(allItems, args.query.statut);
  const sortedItems = sortListingItems(filteredItems);
  const stats = computeListingStats(sortedItems);
  const paginated = paginateItems(
    sortedItems,
    args.query.page,
    args.query.pageSize
  );
  return {
    success: true,
    data: {
      items: paginated,
      total: sortedItems.length,
      page: args.query.page,
      pageSize: args.query.pageSize,
      totalPages: Math.max(
        1,
        Math.ceil(sortedItems.length / args.query.pageSize)
      ),
      stats,
    },
  };
}

function buildEmptyListingResult(
  query: ReleveListingQuery
): ReleveListingResult {
  return {
    items: [],
    total: 0,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: 1,
    stats: ZERO_STATS,
  };
}

const ZERO_STATS: ReleveListingStats = {
  totalSaisis: 0,
  totalAlertes: 0,
  totalManquants: 0,
  totalAnnules: 0,
} as const;

interface LoadedListingData {
  readonly equipements: readonly EquipementRow[];
  readonly releves: readonly ReleveRow[];
}

interface LoadScope {
  readonly dateStart: Date;
  readonly dateEnd: Date;
  readonly boutiqueIds: readonly string[];
  readonly equipementId: string | undefined;
}

function makeLoadScope(args: AssembleArgs): LoadScope {
  return {
    dateStart: parseISODateUtc(args.query.dateStart),
    dateEnd: parseISODateUtc(args.query.dateEnd),
    boutiqueIds: args.boutiqueIds,
    equipementId: args.query.equipementId,
  };
}

async function loadEquipementsData(
  scope: LoadScope
): Promise<readonly EquipementRow[]> {
  const rows = await db.equipement.findMany({
    where: {
      actif: true,
      boutiqueId: { in: [...scope.boutiqueIds] },
      ...(scope.equipementId ? { id: scope.equipementId } : {}),
    },
    orderBy: [{ boutique: { nom: 'asc' } }, { nom: 'asc' }],
    select: EQUIPEMENT_SELECT,
  });
  return rows.map(toEquipementRow);
}

/**
 * Projette une ligne DB en `EquipementRow` en pre-calculant la date de
 * debut effective (`MAX(boutique.dateOuverture, equipement.
 * dateMiseEnService)`, cf. `date-debut.ts`). On la stocke en ISO
 * `YYYY-MM-DD` pour comparer directement aux jours enumeres (eux aussi
 * ISO) sans re-parser a chaque cellule.
 */
function toEquipementRow(row: EquipementDbRow): EquipementRow {
  return {
    id: row.id,
    nom: row.nom,
    boutiqueId: row.boutiqueId,
    boutique: { nom: row.boutique.nom },
    dateDebutEffectiveISO: isoFromDate(
      dateDebutEffective({
        dateOuverture: row.boutique.dateOuverture,
        dateMiseEnService: row.dateMiseEnService,
      })
    ),
  };
}

function loadRelevesData(scope: LoadScope): Promise<readonly ReleveRow[]> {
  // `take: HARD_LIMIT_RELEVES + 1` : le `+1` permet de detecter un
  // depassement (cf. `assembleListing`). Sans cette borne, un ADMIN
  // multi-tenant sur 92 jours x 100 boutiques x 500 equipements x 3
  // creneaux peut materialiser 138k+ lignes en RAM et faire tomber
  // Vercel Hobby (256MB).
  return db.releve.findMany({
    where: {
      date: { gte: scope.dateStart, lte: scope.dateEnd },
      boutiqueId: { in: [...scope.boutiqueIds] },
      ...(scope.equipementId ? { equipementId: scope.equipementId } : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: RELEVE_SELECT,
    take: HARD_LIMIT_RELEVES + 1,
  });
}

/**
 * Charge equipements + releves en parallele (2 queries).
 *
 * NB : on inclut les releves ANNULES (`annuleParId !== null`) -- ils
 * sont projetes en items distincts `statut === 'ANNULE'` par
 * `aggregateListingItems`. Pas de filtre `annuleParId: null` ici.
 */
async function loadListingData(args: AssembleArgs): Promise<LoadedListingData> {
  const scope = makeLoadScope(args);
  const [equipements, releves] = await Promise.all([
    loadEquipementsData(scope),
    loadRelevesData(scope),
  ]);
  return { equipements, releves };
}

const EQUIPEMENT_SELECT = {
  id: true,
  nom: true,
  boutiqueId: true,
  dateMiseEnService: true,
  boutique: { select: { nom: true, dateOuverture: true } },
} as const;

const RELEVE_SELECT = {
  id: true,
  date: true,
  creneau: true,
  temperature: true,
  alerteHorsSeuils: true,
  annuleParId: true,
  motifAnnulation: true,
  createdAt: true,
  equipementId: true,
  boutiqueId: true,
  equipement: { select: { nom: true } },
  boutique: { select: { nom: true } },
  user: { select: { name: true } },
  annule: { select: { motifAnnulation: true } },
} as const;

interface EquipementDbRow {
  readonly id: string;
  readonly nom: string;
  readonly boutiqueId: string;
  readonly dateMiseEnService: Date;
  readonly boutique: { readonly nom: string; readonly dateOuverture: Date };
}

interface EquipementRow {
  readonly id: string;
  readonly nom: string;
  readonly boutiqueId: string;
  readonly boutique: { readonly nom: string };
  /**
   * Jour ISO `YYYY-MM-DD` de debut effectif des releves attendus pour cet
   * equipement. Aucun MANQUANT n'est genere pour un jour anterieur.
   */
  readonly dateDebutEffectiveISO: string;
}

interface ReleveRow {
  readonly id: string;
  readonly date: Date;
  readonly creneau: Creneau;
  readonly temperature: number;
  readonly alerteHorsSeuils: boolean;
  readonly annuleParId: string | null;
  readonly motifAnnulation: string | null;
  readonly createdAt: Date;
  readonly equipementId: string;
  readonly boutiqueId: string;
  readonly equipement: { readonly nom: string };
  readonly boutique: { readonly nom: string };
  readonly user: { readonly name: string };
  readonly annule: { readonly motifAnnulation: string | null } | null;
}

/**
 * Liste les jours ISO `[dateStart, dateEnd]` inclus (`YYYY-MM-DD`).
 * Iteration UTC minuit pour eviter les drifts DST.
 */
function enumerateIsoDays(
  dateStart: string,
  dateEnd: string
): readonly string[] {
  const startMs = parseISODateUtc(dateStart).getTime();
  const endMs = parseISODateUtc(dateEnd).getTime();
  const days: string[] = [];
  for (let t = startMs; t <= endMs; t += MILLIS_PER_DAY) {
    days.push(isoFromDate(new Date(t)));
  }
  return days;
}

interface AggregateArgs {
  readonly jours: readonly string[];
  readonly equipements: readonly EquipementRow[];
  readonly releves: readonly ReleveRow[];
  readonly creneauFilter: Creneau | undefined;
}

interface ReleveBuckets {
  readonly actifs: ReadonlyMap<string, ReleveRow>;
  readonly annules: ReadonlyMap<string, readonly ReleveRow[]>;
}

function bucketReleves(releves: readonly ReleveRow[]): ReleveBuckets {
  const actifs = new Map<string, ReleveRow>();
  const annulesByCell = new Map<string, ReleveRow[]>();
  for (const releve of releves) {
    const dateISO = isoFromDate(releve.date);
    const key = cellKey(dateISO, releve.equipementId, releve.creneau);
    if (releve.annuleParId === null) {
      actifs.set(key, releve);
      continue;
    }
    const existing = annulesByCell.get(key) ?? [];
    annulesByCell.set(key, [...existing, releve]);
  }
  return { actifs, annules: annulesByCell };
}

function cellKey(
  dateISO: string,
  equipementId: string,
  creneau: Creneau
): string {
  return `${dateISO}__${equipementId}__${creneau}`;
}

interface BuildCellItemsArgs {
  readonly dateISO: string;
  readonly equipement: EquipementRow;
  readonly creneau: Creneau;
  readonly buckets: ReleveBuckets;
}

/**
 * Construit les items pour une cellule (date, equipement, creneau) :
 *   - 0 ou 1 actif (=> SAISI ou ALERTE) OU 1 manquant virtuel (=> MANQUANT)
 *   - 0..N annules (=> ANNULE), chronologiquement ordonnes.
 *
 * Le MANQUANT virtuel n'est emis QUE si le jour est attendu (>= date de
 * debut effective de l'equipement). Avant cette date, la cellule vide est
 * neutre : ni MANQUANT ni attendue. Les actifs et annules eventuels
 * (donnees reelles) restent toujours projetes, quel que soit le jour.
 */
function buildCellItems(
  args: BuildCellItemsArgs
): readonly ReleveListingItem[] {
  const key = cellKey(args.dateISO, args.equipement.id, args.creneau);
  const items: ReleveListingItem[] = [];
  const actif = args.buckets.actifs.get(key);
  if (actif) {
    items.push(toItemFromActif(actif, args));
  } else if (args.dateISO >= args.equipement.dateDebutEffectiveISO) {
    items.push(toItemManquant(args));
  }
  const annules = args.buckets.annules.get(key) ?? [];
  for (const annule of annules) {
    items.push(toItemAnnule(annule, args));
  }
  return items;
}

function toItemFromActif(
  releve: ReleveRow,
  args: BuildCellItemsArgs
): ReleveListingItem {
  return {
    id: releve.id,
    dateISO: args.dateISO,
    creneau: args.creneau,
    boutiqueId: args.equipement.boutiqueId,
    boutiqueNom: args.equipement.boutique.nom,
    equipementId: args.equipement.id,
    equipementNom: args.equipement.nom,
    temperature: releve.temperature,
    alerteHorsSeuils: releve.alerteHorsSeuils,
    statut: releve.alerteHorsSeuils ? 'ALERTE' : 'SAISI',
    salarieNom: releve.user.name,
    motifAnnulation: null,
    createdAt: releve.createdAt,
  };
}

function toItemManquant(args: BuildCellItemsArgs): ReleveListingItem {
  return {
    id: null,
    dateISO: args.dateISO,
    creneau: args.creneau,
    boutiqueId: args.equipement.boutiqueId,
    boutiqueNom: args.equipement.boutique.nom,
    equipementId: args.equipement.id,
    equipementNom: args.equipement.nom,
    temperature: null,
    alerteHorsSeuils: false,
    statut: 'MANQUANT',
    salarieNom: null,
    motifAnnulation: null,
    createdAt: null,
  };
}

function toItemAnnule(
  releve: ReleveRow,
  args: BuildCellItemsArgs
): ReleveListingItem {
  return {
    id: releve.id,
    dateISO: args.dateISO,
    creneau: args.creneau,
    boutiqueId: args.equipement.boutiqueId,
    boutiqueNom: args.equipement.boutique.nom,
    equipementId: args.equipement.id,
    equipementNom: args.equipement.nom,
    temperature: releve.temperature,
    alerteHorsSeuils: releve.alerteHorsSeuils,
    statut: 'ANNULE',
    salarieNom: releve.user.name,
    motifAnnulation: releve.annule?.motifAnnulation ?? releve.motifAnnulation,
    createdAt: releve.createdAt,
  };
}

/**
 * Agrege les items listing : jours x equipements x creneaux + annules.
 *
 * Bucket O(1) sur la cle `${dateISO}__${equipementId}__${creneau}`.
 * Si `creneauFilter` present, on n'emit que ce creneau.
 */
function aggregateListingItems(
  args: AggregateArgs
): readonly ReleveListingItem[] {
  const buckets = bucketReleves(args.releves);
  const creneaux: readonly Creneau[] = args.creneauFilter
    ? [args.creneauFilter]
    : CRENEAU_ORDER;
  const items: ReleveListingItem[] = [];
  for (const dateISO of args.jours) {
    for (const equipement of args.equipements) {
      for (const creneau of creneaux) {
        items.push(
          ...buildCellItems({ dateISO, equipement, creneau, buckets })
        );
      }
    }
  }
  return items;
}

/**
 * Filtre les items par statut (apres aggregation pour preserver la stats
 * "totale" eventuelle ; le caller decide quoi compter -- ici stats post
 * filtre, cf. choix decision Phase 0.5).
 *
 * NB : si filtre absent, on retourne directement le tableau (pas de copie).
 */
function applyStatusFilter(
  items: readonly ReleveListingItem[],
  statut: ReleveListingStatut | undefined
): readonly ReleveListingItem[] {
  if (!statut) {
    return items;
  }
  return items.filter((item) => item.statut === statut);
}

const CRENEAU_RANK: Readonly<Record<Creneau, number>> = {
  MATIN: 0,
  MIDI: 1,
  SOIR: 2,
} as const;

/**
 * Tri canonique : date desc -> creneau asc -> equipement asc.
 * Le tri est stable (Array.prototype.sort en Node18+) -> les annules
 * conservent leur ordre chronologique au sein d'une meme cellule.
 */
function sortListingItems(
  items: readonly ReleveListingItem[]
): readonly ReleveListingItem[] {
  return [...items].sort((a, b) => {
    if (a.dateISO !== b.dateISO) {
      return a.dateISO < b.dateISO ? 1 : -1;
    }
    if (a.creneau !== b.creneau) {
      return CRENEAU_RANK[a.creneau] - CRENEAU_RANK[b.creneau];
    }
    return a.equipementNom.localeCompare(b.equipementNom);
  });
}

/**
 * Slice par page/pageSize. `page` est 1-indexed cote API ; on convertit
 * en offset 0-indexed pour `Array.slice`.
 */
function paginateItems(
  items: readonly ReleveListingItem[],
  page: number,
  pageSize: number
): readonly ReleveListingItem[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/**
 * Compte les statuts sur l'ENSEMBLE des items (apres filtres statut OU pas).
 *
 * Decision Phase 0.5 : stats refletent ce que l'utilisateur a applique
 * comme filtres ; si l'utilisateur filtre ALERTE seul, les stats
 * `totalSaisis` seront 0 -- coherence visuelle.
 */
function computeListingStats(
  items: readonly ReleveListingItem[]
): ReleveListingStats {
  let totalSaisis = 0;
  let totalAlertes = 0;
  let totalManquants = 0;
  let totalAnnules = 0;
  for (const item of items) {
    if (item.statut === 'SAISI') {
      totalSaisis += 1;
    } else if (item.statut === 'ALERTE') {
      totalAlertes += 1;
    } else if (item.statut === 'MANQUANT') {
      totalManquants += 1;
    } else {
      totalAnnules += 1;
    }
  }
  return { totalSaisis, totalAlertes, totalManquants, totalAnnules };
}
