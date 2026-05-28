import { AlerteStatus, type Creneau, type Prisma } from '@prisma/client';
import { db } from '@/lib/prisma';
import type { Result } from '@/types/result';
import type {
  AdminDashboardKpis,
  DashboardError,
  EquipementsTodayBoard,
  EquipementsTodayCell,
  EquipementsTodayRow,
  MissingReleveEntry,
  ResponsableDashboardKpis,
  TrendPoint,
} from '@/types/dashboard';
import {
  canManageAlertes,
  canManageParc,
  getAccessibleBoutiqueIds,
  type SessionUser,
} from '@/lib/permissions';
import {
  endOfDay,
  getRecentDaysRange,
  isoFromDate,
  MILLIS_PER_DAY,
  parseISODateUtc,
  todayParisISO,
} from '@/lib/utils/dates';
import { CRENEAU_ORDER } from '@/lib/constants/releve';
import {
  DASHBOARD_MISSING_RELEVE_LIMIT,
  DASHBOARD_TREND_DAYS,
} from '@/lib/constants/dashboard';

/**
 * Service Dashboard (Epic DASHBOARD - Phase 1).
 *
 * Responsabilites :
 *   - `computeResponsableKpis` (US-DAS-001) : KPIs cle du dashboard
 *     responsable (taux jour, alertes ouvertes, manquants, boutiques).
 *   - `computeAdminKpis` (US-DAS-002) : KPIs cle du dashboard admin
 *     (users actifs, boutiques actives, equipements actifs, alertes 7j,
 *     taux global).
 *   - `listMissingReleves` : equipements actifs ayant au moins un
 *     creneau jour manquant. Aide a l'action immediate.
 *   - `buildAlertesTrend` : serie temporelle 7 jours de nb alertes
 *     creees par jour (LineChart).
 *
 * Conventions :
 *   - Toutes les fonctions retournent `Result<T, DashboardError>` pour
 *     que les Server Components puissent reagir uniformement.
 *   - Pas de cache : dashboard temps reel (decision Epic).
 *   - Pas de mutation : lecture seule, donc pas de log applicatif.
 *   - Scope viewer toujours derive via `resolveScope`, qui consulte
 *     `getAccessibleBoutiqueIds` (defense en profondeur, symetrique
 *     avec `alerte.service`).
 */

const NB_CRENEAUX_PER_DAY = CRENEAU_ORDER.length;
const PERCENT_FULL = 100;

interface ScopeArgs {
  readonly viewer: SessionUser;
  readonly boutiqueId?: string;
}

interface DateScopeArgs extends ScopeArgs {
  readonly dateISO?: string;
}

interface ResolvedScope {
  readonly boutiqueIds: readonly string[];
}

/**
 * Resout le scope final : si `boutiqueId` est passe, il doit appartenir
 * a l'accessible du viewer. Sinon, on retourne tout l'accessible.
 */
async function resolveScope({
  viewer,
  boutiqueId,
}: ScopeArgs): Promise<Result<ResolvedScope, DashboardError>> {
  const accessible = await getAccessibleBoutiqueIds(viewer);
  if (!boutiqueId) {
    return { success: true, data: { boutiqueIds: accessible } };
  }
  if (!accessible.includes(boutiqueId)) {
    return { success: false, error: 'FORBIDDEN' };
  }
  return { success: true, data: { boutiqueIds: [boutiqueId] } };
}

function clampPositive(value: number): number {
  return value < 0 ? 0 : value;
}

function roundPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return Math.round((numerator / denominator) * PERCENT_FULL);
}

function targetDateUtc(dateISO: string | undefined): Date {
  return parseISODateUtc(dateISO ?? todayParisISO());
}

interface DayKpiCounts {
  readonly equipementsActifs: number;
  readonly relevesJour: number;
}

async function countEquipementsAndReleves({
  boutiqueIds,
  date,
}: {
  readonly boutiqueIds: readonly string[];
  readonly date: Date;
}): Promise<DayKpiCounts> {
  if (boutiqueIds.length === 0) {
    return { equipementsActifs: 0, relevesJour: 0 };
  }
  const [equipementsActifs, relevesJour] = await Promise.all([
    db.equipement.count({
      where: { actif: true, boutiqueId: { in: [...boutiqueIds] } },
    }),
    db.releve.count({
      where: {
        date,
        annuleParId: null,
        boutiqueId: { in: [...boutiqueIds] },
      },
    }),
  ]);
  return { equipementsActifs, relevesJour };
}

async function countAlertesOuvertes({
  boutiqueIds,
}: {
  readonly boutiqueIds: readonly string[];
}): Promise<number> {
  if (boutiqueIds.length === 0) {
    return 0;
  }
  return db.alerte.count({
    where: {
      status: AlerteStatus.OUVERTE,
      releve: { boutiqueId: { in: [...boutiqueIds] } },
    },
  });
}

/**
 * KPIs du dashboard responsable (US-DAS-001).
 *
 * - Taux conformite jour : nb releves / (nb equipements actifs * 3
 *   creneaux), borne 0..100. Si pas d'equipement actif, on renvoie 0
 *   (defaut prudent : l'UI affiche "-" via convention).
 * - Alertes ouvertes : count sur le scope, tous jours confondus.
 * - Releves manquants jour : `equipements * 3 - releves jour`, clamp >=0.
 * - Boutiques surveillees : taille du scope effectif.
 */
export async function computeResponsableKpis({
  viewer,
  boutiqueId,
  dateISO,
}: DateScopeArgs): Promise<Result<ResponsableDashboardKpis, DashboardError>> {
  if (!canManageAlertes(viewer)) {
    return { success: false, error: 'FORBIDDEN' };
  }
  const scope = await resolveScope({ viewer, boutiqueId });
  if (!scope.success) {
    return scope;
  }
  const { boutiqueIds } = scope.data;
  const date = targetDateUtc(dateISO);
  const [{ equipementsActifs, relevesJour }, alertesOuvertesCount] =
    await Promise.all([
      countEquipementsAndReleves({ boutiqueIds, date }),
      countAlertesOuvertes({ boutiqueIds }),
    ]);
  const expected = equipementsActifs * NB_CRENEAUX_PER_DAY;
  return {
    success: true,
    data: {
      tauxConformiteJour: roundPercent(relevesJour, expected),
      alertesOuvertesCount,
      relevesManquantsJourCount: clampPositive(expected - relevesJour),
      boutiquesCount: boutiqueIds.length,
    },
  };
}

interface AdminAlertCounts {
  readonly ouvertes: number;
  readonly resolues: number;
}

async function countAdminAlerts7j(): Promise<AdminAlertCounts> {
  const { from, to } = getRecentDaysRange(DASHBOARD_TREND_DAYS);
  const baseWhere: Prisma.AlerteWhereInput = {
    createdAt: { gte: from, lte: endOfDay(to) },
  };
  const [ouvertes, resolues] = await Promise.all([
    db.alerte.count({
      where: { ...baseWhere, status: AlerteStatus.OUVERTE },
    }),
    db.alerte.count({
      where: { ...baseWhere, status: AlerteStatus.RESOLUE },
    }),
  ]);
  return { ouvertes, resolues };
}

interface ComputeAdminKpisArgs {
  readonly viewer: SessionUser;
  readonly dateISO?: string;
}

/**
 * KPIs du dashboard admin (US-DAS-002).
 *
 * Tous transverses : pas de scope boutique (l'admin VOIT tout). On garde
 * le guard `canManageParc` en defense en profondeur.
 */
export async function computeAdminKpis({
  viewer,
  dateISO,
}: ComputeAdminKpisArgs): Promise<Result<AdminDashboardKpis, DashboardError>> {
  if (!canManageParc(viewer)) {
    return { success: false, error: 'FORBIDDEN' };
  }
  const date = targetDateUtc(dateISO);
  const [
    utilisateursActifs,
    boutiquesActives,
    equipementsActifs,
    relevesJour,
    { ouvertes, resolues },
  ] = await Promise.all([
    db.user.count({ where: { actif: true } }),
    db.boutique.count({ where: { actif: true } }),
    db.equipement.count({ where: { actif: true } }),
    db.releve.count({ where: { date, annuleParId: null } }),
    countAdminAlerts7j(),
  ]);
  const expected = equipementsActifs * NB_CRENEAUX_PER_DAY;
  return {
    success: true,
    data: {
      utilisateursActifs,
      boutiquesActives,
      equipementsActifs,
      alertes7jOuvertes: ouvertes,
      alertes7jResolues: resolues,
      tauxConformiteGlobal: roundPercent(relevesJour, expected),
    },
  };
}

interface EquipementRow {
  readonly id: string;
  readonly nom: string;
  readonly boutiqueId: string;
  readonly boutique: { readonly nom: string };
}

interface ReleveCreneauRow {
  readonly equipementId: string;
  readonly creneau: Creneau;
}

function groupReleveCreneauxByEquipement(
  rows: readonly ReleveCreneauRow[]
): ReadonlyMap<string, ReadonlySet<Creneau>> {
  const map = new Map<string, Set<Creneau>>();
  for (const row of rows) {
    const existing = map.get(row.equipementId);
    if (existing) {
      existing.add(row.creneau);
    } else {
      map.set(row.equipementId, new Set<Creneau>([row.creneau]));
    }
  }
  return map;
}

function buildMissingEntries({
  equipements,
  relevesByEquipement,
}: {
  readonly equipements: readonly EquipementRow[];
  readonly relevesByEquipement: ReadonlyMap<string, ReadonlySet<Creneau>>;
}): readonly MissingReleveEntry[] {
  const entries: MissingReleveEntry[] = [];
  for (const equipement of equipements) {
    const filled = relevesByEquipement.get(equipement.id);
    const creneauxManquants = CRENEAU_ORDER.filter(
      (creneau) => !filled?.has(creneau)
    );
    if (creneauxManquants.length === 0) {
      continue;
    }
    entries.push({
      equipementId: equipement.id,
      equipementNom: equipement.nom,
      boutiqueId: equipement.boutiqueId,
      boutiqueNom: equipement.boutique.nom,
      creneauxManquants,
    });
  }
  return entries.slice(0, DASHBOARD_MISSING_RELEVE_LIMIT);
}

/**
 * Liste les equipements actifs avec au moins un creneau jour manquant.
 *
 * Tri stable : boutique nom asc puis equipement nom asc (l'ordre est
 * deja garanti par la requete Prisma). Limite haute
 * `DASHBOARD_MISSING_RELEVE_LIMIT` pour proteger l'UI.
 */
export async function listMissingReleves({
  viewer,
  boutiqueId,
  dateISO,
}: DateScopeArgs): Promise<
  Result<readonly MissingReleveEntry[], DashboardError>
> {
  if (!canManageAlertes(viewer)) {
    return { success: false, error: 'FORBIDDEN' };
  }
  const scope = await resolveScope({ viewer, boutiqueId });
  if (!scope.success) {
    return scope;
  }
  const { boutiqueIds } = scope.data;
  if (boutiqueIds.length === 0) {
    return { success: true, data: [] };
  }
  const date = targetDateUtc(dateISO);
  const [equipements, releves] = await Promise.all([
    db.equipement.findMany({
      where: { actif: true, boutiqueId: { in: [...boutiqueIds] } },
      orderBy: [{ boutique: { nom: 'asc' } }, { nom: 'asc' }],
      select: {
        id: true,
        nom: true,
        boutiqueId: true,
        boutique: { select: { nom: true } },
      },
    }),
    db.releve.findMany({
      where: {
        date,
        annuleParId: null,
        boutiqueId: { in: [...boutiqueIds] },
      },
      select: { equipementId: true, creneau: true },
    }),
  ]);
  const relevesByEquipement = groupReleveCreneauxByEquipement(releves);
  return {
    success: true,
    data: buildMissingEntries({ equipements, relevesByEquipement }),
  };
}

interface AlerteTrendRow {
  readonly createdAt: Date;
}

function bucketAlertesByDay(
  rows: readonly AlerteTrendRow[]
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = isoFromDate(row.createdAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function buildTrendSeries({
  from,
  to,
  counts,
}: {
  readonly from: Date;
  readonly to: Date;
  readonly counts: ReadonlyMap<string, number>;
}): readonly TrendPoint[] {
  const series: TrendPoint[] = [];
  let cursor = from.getTime();
  const end = to.getTime();
  while (cursor <= end) {
    const dateISO = isoFromDate(new Date(cursor));
    series.push({ dateISO, value: counts.get(dateISO) ?? 0 });
    cursor += MILLIS_PER_DAY;
  }
  return series;
}

/**
 * Serie temporelle 7 jours du nombre d'alertes creees par jour, scope
 * du viewer (responsable : ses boutiques, admin : transverse).
 *
 * Si `boutiqueId` est fourni, on filtre la serie sur cette boutique
 * apres validation via `resolveScope` (FORBIDDEN si hors-scope). Sinon
 * on agrege sur tout l'accessible. Si l'accessible est vide, on renvoie
 * 7 points a zero (UI homogene).
 *
 * Retourne 7 points dans l'ordre chronologique. Les jours sans alerte
 * ont `value: 0` (la UI doit afficher la continuite).
 */
export async function buildAlertesTrend({
  viewer,
  boutiqueId,
}: ScopeArgs): Promise<Result<readonly TrendPoint[], DashboardError>> {
  if (!canManageAlertes(viewer)) {
    return { success: false, error: 'FORBIDDEN' };
  }
  const scope = await resolveScope({ viewer, boutiqueId });
  if (!scope.success) {
    return scope;
  }
  const { boutiqueIds } = scope.data;
  const { from, to } = getRecentDaysRange(DASHBOARD_TREND_DAYS);
  if (boutiqueIds.length === 0) {
    return {
      success: true,
      data: buildTrendSeries({ from, to, counts: new Map() }),
    };
  }
  const rows = await db.alerte.findMany({
    where: {
      createdAt: { gte: from, lte: endOfDay(to) },
      releve: { boutiqueId: { in: [...boutiqueIds] } },
    },
    select: { createdAt: true },
  });
  const counts = bucketAlertesByDay(rows);
  return { success: true, data: buildTrendSeries({ from, to, counts }) };
}

interface EquipementTodayDbRow {
  readonly id: string;
  readonly nom: string;
  readonly seuilMin: number;
  readonly seuilMax: number;
  readonly boutiqueId: string;
  readonly boutique: { readonly nom: string };
}

interface ReleveTodayDbRow {
  readonly id: string;
  readonly equipementId: string;
  readonly creneau: Creneau;
  readonly temperature: number;
  readonly alerteHorsSeuils: boolean;
  readonly createdAt: Date;
}

function indexRelevesByEquipementCreneau(
  rows: readonly ReleveTodayDbRow[]
): ReadonlyMap<string, ReleveTodayDbRow> {
  const map = new Map<string, ReleveTodayDbRow>();
  for (const row of rows) {
    map.set(`${row.equipementId}:${row.creneau}`, row);
  }
  return map;
}

function buildCell({
  releve,
  creneau,
}: {
  readonly releve: ReleveTodayDbRow | undefined;
  readonly creneau: Creneau;
}): EquipementsTodayCell {
  if (!releve) {
    return {
      statut: 'MANQUANT',
      temperature: null,
      releveId: null,
      creneau,
      saisiAt: null,
    };
  }
  return {
    statut: releve.alerteHorsSeuils ? 'ALERTE' : 'SAISI',
    temperature: releve.temperature,
    releveId: releve.id,
    creneau,
    saisiAt: releve.createdAt,
  };
}

function buildEquipementRow({
  equipement,
  relevesByKey,
}: {
  readonly equipement: EquipementTodayDbRow;
  readonly relevesByKey: ReadonlyMap<string, ReleveTodayDbRow>;
}): EquipementsTodayRow {
  const cells = CRENEAU_ORDER.reduce<Record<Creneau, EquipementsTodayCell>>(
    (acc, creneau) => {
      acc[creneau] = buildCell({
        releve: relevesByKey.get(`${equipement.id}:${creneau}`),
        creneau,
      });
      return acc;
    },
    {} as Record<Creneau, EquipementsTodayCell>
  );
  return {
    equipementId: equipement.id,
    equipementNom: equipement.nom,
    boutiqueId: equipement.boutiqueId,
    boutiqueNom: equipement.boutique.nom,
    seuilMin: equipement.seuilMin,
    seuilMax: equipement.seuilMax,
    cells,
  };
}

/**
 * Resout le scope du board "equipements jour" pour TOUS les roles
 * (SALARIE inclus). Diffraction avec `resolveScope` : ici on n'a pas
 * besoin du guard `canManageAlertes` -- la securite est portee par
 * `getAccessibleBoutiqueIds` qui retourne :
 *   - SALARIE     : sa boutique unique (ou [] si pas affecte)
 *   - RESPONSABLE : ses boutiques
 *   - ADMIN       : toutes les boutiques actives
 */
async function resolveBoardScope({
  viewer,
  boutiqueId,
}: ScopeArgs): Promise<Result<ResolvedScope, DashboardError>> {
  const accessible = await getAccessibleBoutiqueIds(viewer);
  if (!boutiqueId) {
    return { success: true, data: { boutiqueIds: accessible } };
  }
  if (!accessible.includes(boutiqueId)) {
    return { success: false, error: 'FORBIDDEN' };
  }
  return { success: true, data: { boutiqueIds: [boutiqueId] } };
}

/**
 * Charge le tableau "Equipements x Creneaux du jour" pour le dashboard
 * accueil (feat/dashboard-as-home).
 *
 * Accessible aux 3 roles : la securite est portee par le scope viewer
 * (SALARIE -> sa boutique, RESPONSABLE -> ses boutiques, ADMIN -> tout).
 *
 * Algorithme :
 *   1. Resout le scope (accessible OU boutiqueId filtre).
 *   2. Charge en parallele : equipements actifs + releves actifs du
 *      jour (annuleParId IS NULL).
 *   3. Indexe les releves par `equipementId:creneau` (O(1) lookup).
 *   4. Construit 1 ligne par equipement avec 3 cellules :
 *      - releve trouve : `SAISI` ou `ALERTE` selon `alerteHorsSeuils`.
 *      - sinon         : `MANQUANT` (l'UI affiche un CTA "Saisir").
 *
 * Performance : 2 queries, agregation memoire bornee par le parc.
 */
export async function loadEquipementsTodayBoard({
  viewer,
  boutiqueId,
  dateISO,
}: DateScopeArgs): Promise<Result<EquipementsTodayBoard, DashboardError>> {
  const scope = await resolveBoardScope({ viewer, boutiqueId });
  if (!scope.success) {
    return scope;
  }
  const targetISO = dateISO ?? todayParisISO();
  const { boutiqueIds } = scope.data;
  if (boutiqueIds.length === 0) {
    return { success: true, data: { dateISO: targetISO, rows: [] } };
  }
  const date = parseISODateUtc(targetISO);
  const [equipements, releves] = await Promise.all([
    db.equipement.findMany({
      where: { actif: true, boutiqueId: { in: [...boutiqueIds] } },
      orderBy: [{ boutique: { nom: 'asc' } }, { nom: 'asc' }],
      select: {
        id: true,
        nom: true,
        seuilMin: true,
        seuilMax: true,
        boutiqueId: true,
        boutique: { select: { nom: true } },
      },
    }),
    db.releve.findMany({
      where: {
        date,
        annuleParId: null,
        boutiqueId: { in: [...boutiqueIds] },
      },
      select: {
        id: true,
        equipementId: true,
        creneau: true,
        temperature: true,
        alerteHorsSeuils: true,
        createdAt: true,
      },
    }),
  ]);
  const relevesByKey = indexRelevesByEquipementCreneau(releves);
  const rows = equipements.map((equipement) =>
    buildEquipementRow({ equipement, relevesByKey })
  );
  return { success: true, data: { dateISO: targetISO, rows } };
}
