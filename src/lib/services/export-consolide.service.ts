import { AlerteStatus, type Creneau, type UserRole } from '@prisma/client';
import { db } from '@/lib/prisma';
import { canExport, getAccessibleBoutiqueIds } from '@/lib/permissions';
import {
  MILLIS_PER_DAY,
  isoFromDate,
  parseISODateUtc,
  todayParisISO,
} from '@/lib/utils/dates';
import {
  CRENEAUX_PAR_JOUR,
  MAX_PERIODE_DAYS,
} from '@/lib/constants/export-consolide';
import { logger } from '@/lib/logger';
import type { Result } from '@/types/result';
import type {
  BoutiqueSummary,
  ConsolideAlerte,
  ConsolideJour,
  ConsolideJourEquipement,
  ConsolideJourReleves,
  ConsolideReleveCell,
  ConsolideSignature,
  ExportConsolideError,
  RegistreConsolide,
  RegistreConsolideQuery,
  RegistreConsolideStats,
  RegistreConsolideViewer,
} from '@/types/export-consolide';

/**
 * Service `export-consolide` (Epic REGISTRE -- US-REG-001).
 *
 * Responsabilites :
 *   - `buildRegistreConsolide` : agrege releves + alertes + signatures
 *     d'une periode personnalisee (1..MAX_PERIODE_DAYS jours) en une
 *     structure consommable par le pdf-builder (Phase 2).
 *
 * Securite :
 *   - `canExport(viewer)` -> FORBIDDEN sinon (SALARIE exclu).
 *   - Scope strict via `getAccessibleBoutiqueIds` :
 *      - Si `boutiqueId` est fourni : il doit appartenir au scope
 *        (sinon `BOUTIQUE_NOT_FOUND`, anti-enum).
 *      - Sinon : mode "toutes mes boutiques" => scope viewer complet.
 *
 * Performance :
 *   - Une seule charge DB en `Promise.all` (5 queries paralleles), puis
 *     agregation en memoire. Volume max realiste : 31 jours x 5
 *     boutiques x 5 equipements x 3 creneaux = 2 325 releves -- en RAM
 *     sur Vercel Hobby (250 MB) sans risque.
 *   - Pas de N+1 : toutes les jointures necessaires sont incluses dans
 *     les `findMany` (cf. `EQUIPEMENT_SELECT`, `RELEVE_SELECT`...).
 *   - `accessibleBoutiqueIds` peut etre injecte par l'appelant (PERF-2)
 *     pour eviter un double appel a `getAccessibleBoutiqueIds`.
 */

const ALERTES_HARD_TAKE_LIMIT = 5_000;

interface BuildArgs {
  readonly viewer: RegistreConsolideViewer;
  readonly query: RegistreConsolideQuery;
  /**
   * IDs de boutiques accessibles deja resolus par l'appelant (PERF-2).
   * Si absent, le service appelle `getAccessibleBoutiqueIds` lui-meme.
   */
  readonly accessibleBoutiqueIds?: readonly string[];
}

/**
 * Orchestre l'agregation du registre consolide.
 *
 * Etapes (chacune isolee en helper SRP <20 lignes pour la lisibilite) :
 *   1. Guard `canExport`.
 *   2. Validation de la periode (defense en profondeur cote service).
 *   3. Resolution du scope boutiques (single ou "toutes").
 *   4. Chargement parallele DB.
 *   5. Agregation memoire (jours x equipements, alertes, signatures, stats).
 */
export async function buildRegistreConsolide(
  args: BuildArgs
): Promise<Result<RegistreConsolide, ExportConsolideError>> {
  if (!canExport(args.viewer)) {
    return { success: false, error: 'FORBIDDEN' };
  }
  const periodeCheck = validatePeriode(args.query);
  if (!periodeCheck.success) {
    return periodeCheck;
  }
  const scope = await resolveBoutiqueScope({
    viewer: args.viewer,
    boutiqueId: args.query.boutiqueId,
    accessibleBoutiqueIds: args.accessibleBoutiqueIds,
  });
  if (!scope.success) {
    return scope;
  }
  return runAssembleWithLogging({ ...args, boutiqueIds: scope.data });
}

interface RunAssembleArgs extends BuildArgs {
  readonly boutiqueIds: readonly string[];
}

async function runAssembleWithLogging(
  args: RunAssembleArgs
): Promise<Result<RegistreConsolide, ExportConsolideError>> {
  try {
    return await assembleConsolide({
      query: args.query,
      boutiqueIds: args.boutiqueIds,
    });
  } catch (error) {
    logger.error('[export-consolide.service] aggregation failed', {
      viewerId: args.viewer.id,
      dateStart: args.query.dateStart,
      dateEnd: args.query.dateEnd,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return { success: false, error: 'INTERNAL' };
  }
}

/**
 * Valide la periode `[dateStart, dateEnd]` cote service (Zod l'a deja fait
 * a l'API ; on rejoue pour les appels directs depuis tests/scripts et
 * defense en profondeur).
 */
function validatePeriode(
  query: RegistreConsolideQuery
): Result<true, ExportConsolideError> {
  if (query.dateEnd < query.dateStart) {
    return { success: false, error: 'PERIODE_INVALID' };
  }
  const days = countDaysInclusive(query.dateStart, query.dateEnd);
  if (days > MAX_PERIODE_DAYS) {
    return { success: false, error: 'PERIODE_TOO_LARGE' };
  }
  if (query.dateEnd > todayParisISO()) {
    return { success: false, error: 'PERIODE_IN_FUTURE' };
  }
  return { success: true, data: true };
}

function countDaysInclusive(dateStart: string, dateEnd: string): number {
  const startMs = parseISODateUtc(dateStart).getTime();
  const endMs = parseISODateUtc(dateEnd).getTime();
  return Math.floor((endMs - startMs) / MILLIS_PER_DAY) + 1;
}

interface ResolveBoutiqueScopeArgs {
  readonly viewer: RegistreConsolideViewer;
  readonly boutiqueId: string | undefined;
  readonly accessibleBoutiqueIds: readonly string[] | undefined;
}

/**
 * Resout les IDs de boutiques cibles.
 *
 * - `boutiqueId` fourni : on verifie qu'il fait partie du scope viewer
 *   (`BOUTIQUE_NOT_FOUND` sinon, anti-enum strict).
 * - Sinon (mode "toutes") : scope complet du viewer.
 *
 * Si l'appelant fournit deja `accessibleBoutiqueIds` (PERF-2), on
 * l'utilise tel quel et on evite un appel `getAccessibleBoutiqueIds`
 * supplementaire.
 */
async function resolveBoutiqueScope(
  args: ResolveBoutiqueScopeArgs
): Promise<Result<readonly string[], ExportConsolideError>> {
  const accessible =
    args.accessibleBoutiqueIds ?? (await getAccessibleBoutiqueIds(args.viewer));
  if (args.boutiqueId) {
    if (!accessible.includes(args.boutiqueId)) {
      return { success: false, error: 'BOUTIQUE_NOT_FOUND' };
    }
    return { success: true, data: [args.boutiqueId] };
  }
  return { success: true, data: accessible };
}

interface AssembleArgs {
  readonly query: RegistreConsolideQuery;
  readonly boutiqueIds: readonly string[];
}

async function assembleConsolide(
  args: AssembleArgs
): Promise<Result<RegistreConsolide, ExportConsolideError>> {
  if (args.boutiqueIds.length === 0) {
    return { success: true, data: buildEmptyConsolide(args.query) };
  }
  const loaded = await loadConsolideData(args);
  const periodeDays = enumerateIsoDays(
    args.query.dateStart,
    args.query.dateEnd
  );
  const data = buildRegistreFromLoaded({
    query: args.query,
    loaded,
    periodeDays,
  });
  return { success: true, data };
}

interface BuildFromLoadedArgs {
  readonly query: RegistreConsolideQuery;
  readonly loaded: LoadedData;
  readonly periodeDays: readonly string[];
}

interface BuiltSections {
  readonly jours: readonly ConsolideJour[];
  readonly alertes: readonly ConsolideAlerte[];
  readonly signatures: readonly ConsolideSignature[];
  readonly stats: RegistreConsolideStats;
}

function buildSections(args: BuildFromLoadedArgs): BuiltSections {
  const jours = aggregateJours({
    periodeDays: args.periodeDays,
    equipements: args.loaded.equipements,
    releves: args.loaded.releves,
  });
  const alertes = aggregateAlertes(args.loaded.alertes);
  const signatures = aggregateSignatures(args.loaded.signatures);
  const stats = computeStats({
    jours: args.periodeDays.length,
    equipementsCount: args.loaded.equipements.length,
    relevesCount: args.loaded.releves.length,
    alertes,
    signatures,
  });
  return { jours, alertes, signatures, stats };
}

function buildRegistreFromLoaded(args: BuildFromLoadedArgs): RegistreConsolide {
  const sections = buildSections(args);
  return {
    periode: {
      dateStart: args.query.dateStart,
      dateEnd: args.query.dateEnd,
      jours: args.periodeDays.length,
    },
    boutiques: args.loaded.boutiques.map(toBoutiqueSummary),
    ...sections,
  };
}

function buildEmptyConsolide(query: RegistreConsolideQuery): RegistreConsolide {
  const jours = enumerateIsoDays(query.dateStart, query.dateEnd).length;
  return {
    periode: { dateStart: query.dateStart, dateEnd: query.dateEnd, jours },
    boutiques: [],
    jours: [],
    alertes: [],
    signatures: [],
    stats: ZERO_STATS,
  };
}

const ZERO_STATS: RegistreConsolideStats = {
  totalRelevesAttendus: 0,
  totalRelevesSaisis: 0,
  relevesManquants: 0,
  tauxConformite: 0,
  totalAlertes: 0,
  alertesOuvertes: 0,
  alertesTraitees: 0,
  tauxResolutionAlertes: 0,
  totalSignatures: 0,
  joursAvecSignature: 0,
} as const;

interface LoadedData {
  readonly boutiques: readonly BoutiqueRow[];
  readonly equipements: readonly EquipementRow[];
  readonly releves: readonly ReleveRow[];
  readonly alertes: readonly AlerteRow[];
  readonly signatures: readonly SignatureRow[];
}

interface LoadScope {
  readonly dateStart: Date;
  readonly dateEnd: Date;
  readonly boutiqueIds: string[];
  readonly dateStartISO: string;
  readonly dateEndISO: string;
}

function makeLoadScope(args: AssembleArgs): LoadScope {
  const dateStart = parseISODateUtc(args.query.dateStart);
  const dateEnd = parseISODateUtc(args.query.dateEnd);
  return {
    dateStart,
    dateEnd,
    boutiqueIds: [...args.boutiqueIds],
    dateStartISO: args.query.dateStart,
    dateEndISO: args.query.dateEnd,
  };
}

function loadBoutiquesData(scope: LoadScope): Promise<readonly BoutiqueRow[]> {
  return db.boutique.findMany({
    where: { id: { in: scope.boutiqueIds } },
    orderBy: { nom: 'asc' },
    select: BOUTIQUE_SELECT,
  });
}

function loadEquipementsData(
  scope: LoadScope
): Promise<readonly EquipementRow[]> {
  return db.equipement.findMany({
    where: { boutiqueId: { in: scope.boutiqueIds }, actif: true },
    orderBy: [{ boutique: { nom: 'asc' } }, { nom: 'asc' }],
    select: EQUIPEMENT_SELECT,
  });
}

function loadRelevesData(scope: LoadScope): Promise<readonly ReleveRow[]> {
  return db.releve.findMany({
    where: {
      date: { gte: scope.dateStart, lte: scope.dateEnd },
      annuleParId: null,
      boutiqueId: { in: scope.boutiqueIds },
    },
    select: RELEVE_SELECT,
  });
}

function loadAlertesData(scope: LoadScope): Promise<readonly AlerteRow[]> {
  return db.alerte.findMany({
    where: {
      releve: {
        date: { gte: scope.dateStart, lte: scope.dateEnd },
        boutiqueId: { in: scope.boutiqueIds },
      },
    },
    orderBy: { createdAt: 'asc' },
    select: ALERTE_SELECT,
    take: ALERTES_HARD_TAKE_LIMIT,
  });
}

function loadSignaturesData(
  scope: LoadScope
): Promise<readonly SignatureRow[]> {
  return db.signature.findMany({
    where: {
      boutiqueId: { in: scope.boutiqueIds },
      dateISO: { gte: scope.dateStartISO, lte: scope.dateEndISO },
    },
    orderBy: { signedAt: 'asc' },
    select: SIGNATURE_SELECT,
  });
}

/**
 * Charge toutes les donnees necessaires en 5 queries paralleles.
 *
 * Les bornes `gte`/`lte` sur `Releve.date` (et `Alerte.releve.date`)
 * utilisent `parseISODateUtc` pour s'aligner sur le storage UTC minuit
 * documente dans `dates.ts`.
 *
 * Defense DoS (SEC-4) : `loadAlertesData` borne avec `take: 5000` --
 * une explosion d'alertes (incident matos en cascade) ne doit pas
 * faire exploser la RAM du PDF.
 */
async function loadConsolideData(args: AssembleArgs): Promise<LoadedData> {
  const scope = makeLoadScope(args);
  const [boutiques, equipements, releves, alertes, signatures] =
    await Promise.all([
      loadBoutiquesData(scope),
      loadEquipementsData(scope),
      loadRelevesData(scope),
      loadAlertesData(scope),
      loadSignaturesData(scope),
    ]);
  return { boutiques, equipements, releves, alertes, signatures };
}

const BOUTIQUE_SELECT = {
  id: true,
  nom: true,
  ville: true,
} as const;

const EQUIPEMENT_SELECT = {
  id: true,
  nom: true,
  boutiqueId: true,
  boutique: { select: { nom: true } },
} as const;

const RELEVE_SELECT = {
  date: true,
  creneau: true,
  temperature: true,
  alerteHorsSeuils: true,
  equipementId: true,
  boutiqueId: true,
  user: { select: { name: true } },
} as const;

const ALERTE_SELECT = {
  id: true,
  status: true,
  commentaireResolution: true,
  createdAt: true,
  resoluAt: true,
  resoluPar: { select: { name: true } },
  releve: {
    select: {
      date: true,
      creneau: true,
      temperature: true,
      equipement: { select: { nom: true } },
      boutique: { select: { nom: true } },
      user: { select: { name: true } },
    },
  },
} as const;

const SIGNATURE_SELECT = {
  id: true,
  dateISO: true,
  signataireRoleSnapshot: true,
  signedAt: true,
  signataire: { select: { name: true } },
  boutique: { select: { nom: true } },
} as const;

interface BoutiqueRow {
  readonly id: string;
  readonly nom: string;
  readonly ville: string | null;
}

interface EquipementRow {
  readonly id: string;
  readonly nom: string;
  readonly boutiqueId: string;
  readonly boutique: { readonly nom: string };
}

interface ReleveRow {
  readonly date: Date;
  readonly creneau: Creneau;
  readonly temperature: number;
  readonly alerteHorsSeuils: boolean;
  readonly equipementId: string;
  readonly boutiqueId: string;
  readonly user: { readonly name: string };
}

interface AlerteRow {
  readonly id: string;
  readonly status: AlerteStatus;
  readonly commentaireResolution: string | null;
  readonly createdAt: Date;
  readonly resoluAt: Date | null;
  readonly resoluPar: { readonly name: string } | null;
  readonly releve: {
    readonly date: Date;
    readonly creneau: Creneau;
    readonly temperature: number;
    readonly equipement: { readonly nom: string };
    readonly boutique: { readonly nom: string };
    readonly user: { readonly name: string };
  };
}

interface SignatureRow {
  readonly id: string;
  readonly dateISO: string;
  readonly signataireRoleSnapshot: UserRole;
  readonly signedAt: Date;
  readonly signataire: { readonly name: string };
  readonly boutique: { readonly nom: string };
}

function toBoutiqueSummary(row: BoutiqueRow): BoutiqueSummary {
  return { id: row.id, nom: row.nom, ville: row.ville };
}

/**
 * Liste les jours ISO `[dateStart, dateEnd]` inclus (`YYYY-MM-DD`).
 *
 * On itere en UTC minuit (cf. `parseISODateUtc`) pour eviter les DST
 * shifts qui ajouteraient/retireraient une heure et casseraient le
 * comptage de jours.
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

interface AggregateJoursArgs {
  readonly periodeDays: readonly string[];
  readonly equipements: readonly EquipementRow[];
  readonly releves: readonly ReleveRow[];
}

/**
 * Construit la matrice jours x equipements et place chaque releve dans
 * la cellule (jour, equipement, creneau) correspondante.
 *
 * Bucket O(1) : map indexee par `${dateISO}__${equipementId}__${creneau}`.
 */
function aggregateJours({
  periodeDays,
  equipements,
  releves,
}: AggregateJoursArgs): readonly ConsolideJour[] {
  const releveIndex = indexRelevesByDayEquipementCreneau(releves);
  return periodeDays.map((dateISO) => ({
    dateISO,
    equipements: equipements.map((eq) =>
      buildJourEquipement({ dateISO, equipement: eq, releveIndex })
    ),
  }));
}

function releveBucketKey(
  dateISO: string,
  equipementId: string,
  creneau: Creneau
): string {
  return `${dateISO}__${equipementId}__${creneau}`;
}

function indexRelevesByDayEquipementCreneau(
  releves: readonly ReleveRow[]
): ReadonlyMap<string, ReleveRow> {
  const map = new Map<string, ReleveRow>();
  for (const releve of releves) {
    const dateISO = isoFromDate(releve.date);
    map.set(
      releveBucketKey(dateISO, releve.equipementId, releve.creneau),
      releve
    );
  }
  return map;
}

interface BuildJourEquipementArgs {
  readonly dateISO: string;
  readonly equipement: EquipementRow;
  readonly releveIndex: ReadonlyMap<string, ReleveRow>;
}

function buildJourEquipement({
  dateISO,
  equipement,
  releveIndex,
}: BuildJourEquipementArgs): ConsolideJourEquipement {
  return {
    equipementId: equipement.id,
    equipementNom: equipement.nom,
    boutiqueId: equipement.boutiqueId,
    boutiqueNom: equipement.boutique.nom,
    releves: {
      matin: cellFor({ dateISO, equipement, releveIndex, creneau: 'MATIN' }),
      midi: cellFor({ dateISO, equipement, releveIndex, creneau: 'MIDI' }),
      soir: cellFor({ dateISO, equipement, releveIndex, creneau: 'SOIR' }),
    } satisfies ConsolideJourReleves,
  };
}

interface CellForArgs extends BuildJourEquipementArgs {
  readonly creneau: Creneau;
}

function cellFor({
  dateISO,
  equipement,
  releveIndex,
  creneau,
}: CellForArgs): ConsolideReleveCell | null {
  const releve = releveIndex.get(
    releveBucketKey(dateISO, equipement.id, creneau)
  );
  if (!releve) {
    return null;
  }
  return {
    temperature: releve.temperature,
    alerte: releve.alerteHorsSeuils,
    salarieNom: releve.user.name,
  };
}

function aggregateAlertes(
  rows: readonly AlerteRow[]
): readonly ConsolideAlerte[] {
  return rows.map(toConsolideAlerte);
}

function toConsolideAlerte(row: AlerteRow): ConsolideAlerte {
  return {
    id: row.id,
    dateISO: isoFromDate(row.releve.date),
    equipementNom: row.releve.equipement.nom,
    boutiqueNom: row.releve.boutique.nom,
    temperature: row.releve.temperature,
    creneau: row.releve.creneau,
    statut: row.status,
    motif: row.commentaireResolution,
    salarieNom: row.releve.user.name,
    signaleeAt: row.createdAt,
    traiteeAt: row.resoluAt,
    traiteParNom: row.resoluPar?.name ?? null,
  };
}

function aggregateSignatures(
  rows: readonly SignatureRow[]
): readonly ConsolideSignature[] {
  return rows.map(toConsolideSignature);
}

function toConsolideSignature(row: SignatureRow): ConsolideSignature {
  return {
    id: row.id,
    dateISO: row.dateISO,
    boutiqueNom: row.boutique.nom,
    signataireNom: row.signataire.name,
    signataireRoleSnapshot: row.signataireRoleSnapshot,
    signedAt: row.signedAt,
  };
}

interface ComputeStatsArgs {
  readonly jours: number;
  readonly equipementsCount: number;
  readonly relevesCount: number;
  readonly alertes: readonly ConsolideAlerte[];
  readonly signatures: readonly ConsolideSignature[];
}

const PERCENT_FULL = 100;

function roundPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return Math.round((numerator / denominator) * PERCENT_FULL);
}

interface RelevesStats {
  readonly totalRelevesAttendus: number;
  readonly totalRelevesSaisis: number;
  readonly relevesManquants: number;
  readonly tauxConformite: number;
}

function computeRelevesStats(args: ComputeStatsArgs): RelevesStats {
  const totalRelevesAttendus =
    args.jours * args.equipementsCount * CRENEAUX_PAR_JOUR;
  const totalRelevesSaisis = args.relevesCount;
  const relevesManquants = Math.max(
    totalRelevesAttendus - totalRelevesSaisis,
    0
  );
  return {
    totalRelevesAttendus,
    totalRelevesSaisis,
    relevesManquants,
    tauxConformite: roundPercent(totalRelevesSaisis, totalRelevesAttendus),
  };
}

interface AlertesStats {
  readonly totalAlertes: number;
  readonly alertesOuvertes: number;
  readonly alertesTraitees: number;
  readonly tauxResolutionAlertes: number;
}

function computeAlertesStats(
  alertes: readonly ConsolideAlerte[]
): AlertesStats {
  const alertesOuvertes = alertes.filter(isAlerteOuverte).length;
  const alertesTraitees = alertes.length - alertesOuvertes;
  return {
    totalAlertes: alertes.length,
    alertesOuvertes,
    alertesTraitees,
    tauxResolutionAlertes: roundPercent(alertesTraitees, alertes.length),
  };
}

interface SignaturesStats {
  readonly totalSignatures: number;
  readonly joursAvecSignature: number;
}

function computeSignaturesStats(
  signatures: readonly ConsolideSignature[]
): SignaturesStats {
  return {
    totalSignatures: signatures.length,
    joursAvecSignature: countDistinctSignatureDays(signatures),
  };
}

function computeStats(args: ComputeStatsArgs): RegistreConsolideStats {
  return {
    ...computeRelevesStats(args),
    ...computeAlertesStats(args.alertes),
    ...computeSignaturesStats(args.signatures),
  };
}

function isAlerteOuverte(alerte: ConsolideAlerte): boolean {
  return alerte.statut === AlerteStatus.OUVERTE;
}

function countDistinctSignatureDays(
  signatures: readonly ConsolideSignature[]
): number {
  const days = new Set<string>();
  for (const signature of signatures) {
    days.add(signature.dateISO);
  }
  return days.size;
}
