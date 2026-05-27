import { Prisma } from '@prisma/client';
import { db } from '@/lib/prisma';
import {
  canExport,
  getAccessibleBoutiqueIds,
  type SessionUser,
} from '@/lib/permissions';
import { parseISODateUtc, todayParisISO } from '@/lib/utils/dates';
import { MAX_EXPORT_ROWS } from '@/lib/constants/export';
import { logAudit } from '@/lib/services/audit-log.service';
import { getSignatureForRegistre } from '@/lib/services/signature.service';
import { logger } from '@/lib/logger';
import type {
  ExportCsvRow,
  ExportError,
  ExportFormat,
  RegistreJournalier,
  RegistreJournalierAlerteEntry,
  RegistreJournalierCreneau,
  RegistreJournalierForExport,
  RegistreJournalierRow,
  RegistreJournalierSignature,
} from '@/types/export';
import type { SignatureRow } from '@/types/signature';
import type { ExportCsvQuery, ExportPdfQuery } from '@/lib/validations/export';
import type { Result } from '@/types/result';

/**
 * Service export (Epic EXPORT).
 *
 * Responsabilites :
 *   - `listForExportCsv` : projette les releves d'une periode en
 *     `ExportCsvRow[]` pretes a passer a `encodeCsv`. Borne `take` a
 *     `MAX_EXPORT_ROWS + 1` pour detecter le depassement sans charger
 *     la totalite en memoire.
 *   - `buildRegistreJournalier` : projette le registre d'un jour pour
 *     UNE boutique (= scope CCF "registre journalier" DDPP).
 *   - `logExportSuccess` : trace l'export dans `AuditLog` avec
 *     `action=EXPORT` / `entityType=EXPORT` (cf. migration
 *     `add_audit_export_enum`). `entityId` = UUID genere ad-hoc puisque
 *     l'export n'est pas une entite stockee.
 *
 * Toutes les fonctions verifient `canExport(viewer)` (RESPONSABLE+ADMIN)
 * et scope multi-tenant via `getAccessibleBoutiqueIds`.
 */

const PARIS_HOUR_MINUTE = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
  hour12: false,
});

interface ListForExportCsvArgs {
  readonly viewer: SessionUser;
  readonly query: ExportCsvQuery;
}

export async function listForExportCsv({
  viewer,
  query,
}: ListForExportCsvArgs): Promise<
  Result<readonly ExportCsvRow[], ExportError>
> {
  if (!canExport(viewer)) {
    return { success: false, error: 'FORBIDDEN' };
  }
  const accessible = await getAccessibleBoutiqueIds(viewer);
  if (accessible.length === 0) {
    return { success: true, data: [] };
  }
  if (query.boutiqueId && !accessible.includes(query.boutiqueId)) {
    return { success: false, error: 'BOUTIQUE_NOT_FOUND' };
  }
  const boutiqueScope = query.boutiqueId ? [query.boutiqueId] : [...accessible];
  // Security: si un equipementId est fourni, on verifie qu'il appartient
  // bien a une boutique du scope du viewer. Sans ce check, le filtre
  // `equipementId` etait applique tel quel dans le WHERE -- un viewer
  // pouvait passer un id arbitraire et profiter du fait que `boutiqueId
  // IN (...)` filtre seul. On retourne `BOUTIQUE_NOT_FOUND` (anti-enum,
  // coherent avec le check boutiqueId au-dessus).
  if (query.equipementId) {
    const equipement = await db.equipement.findFirst({
      where: { id: query.equipementId, boutiqueId: { in: boutiqueScope } },
      select: { id: true },
    });
    if (!equipement) {
      return { success: false, error: 'BOUTIQUE_NOT_FOUND' };
    }
  }
  const where: Prisma.ReleveWhereInput = {
    date: {
      gte: parseISODateUtc(query.dateFrom),
      lte: parseISODateUtc(query.dateTo),
    },
    boutiqueId: { in: boutiqueScope },
    ...(query.equipementId ? { equipementId: query.equipementId } : {}),
  };
  const rows = await db.releve.findMany({
    where,
    orderBy: [
      { date: 'asc' },
      { boutiqueId: 'asc' },
      { equipementId: 'asc' },
      { creneau: 'asc' },
    ],
    take: MAX_EXPORT_ROWS + 1,
    include: {
      equipement: { select: { nom: true, seuilMin: true, seuilMax: true } },
      boutique: { select: { nom: true } },
      user: { select: { name: true } },
      annule: { select: { motifAnnulation: true } },
    },
  });
  if (rows.length > MAX_EXPORT_ROWS) {
    return { success: false, error: 'RANGE_TOO_LARGE' };
  }
  const data: ExportCsvRow[] = rows.map((row) => ({
    date: todayParisISO(row.date),
    creneau: row.creneau,
    equipementNom: row.equipement.nom,
    boutiqueNom: row.boutique.nom,
    temperature: row.temperature,
    seuilMin: row.equipement.seuilMin,
    seuilMax: row.equipement.seuilMax,
    alerteHorsSeuils: row.alerteHorsSeuils,
    commentaire: row.commentaire,
    signature: row.signature,
    salarieNom: row.user.name,
    statut: row.annuleParId === null ? 'ACTIF' : 'ANNULE',
    motifAnnulation: row.annule?.motifAnnulation ?? row.motifAnnulation ?? null,
  }));
  return { success: true, data };
}

interface BuildRegistreJournalierArgs {
  readonly viewer: SessionUser;
  readonly query: ExportPdfQuery;
  readonly performedByName: string;
  readonly performedByRole: string;
}

interface RegistreBaseArgs {
  readonly viewer: SessionUser;
  readonly query: ExportPdfQuery;
  readonly performedByName: string;
  readonly performedByRole: string;
}

/**
 * Charge le registre journalier d'une boutique pour LECTURE (page detail).
 *
 * Ouvert aux 3 roles (SALARIE/RESPONSABLE/ADMIN) tant que la boutique
 * est dans le scope multi-tenant du viewer. NE CONTIENT PAS la signature
 * (chargee separement par `SignatureSection` pour decoupler le check
 * d'export et eviter un double fetch).
 *
 * Utilisee par : page detail `/boutiques/[boutiqueId]/registre/[dateISO]`.
 */
export async function readRegistreJournalier(
  args: RegistreBaseArgs
): Promise<Result<RegistreJournalier, ExportError>> {
  const scopeCheck = await ensureBoutiqueInScope(
    args.viewer,
    args.query.boutiqueId
  );
  if (!scopeCheck.success) {
    return scopeCheck;
  }
  return loadRegistreBase(args);
}

/**
 * Charge le registre journalier d'une boutique pour EXPORT PDF.
 *
 * Restreint aux roles autorises a exporter (RESPONSABLE + ADMIN) via
 * `canExport`. EMBARQUE la signature manuscrite (1 fetch additionnel
 * parallelise avec les autres queries).
 *
 * Utilisee par : route `/api/exports/pdf` uniquement.
 */
export async function buildRegistreJournalierForExport(
  args: BuildRegistreJournalierArgs
): Promise<Result<RegistreJournalierForExport, ExportError>> {
  if (!canExport(args.viewer)) {
    return { success: false, error: 'FORBIDDEN' };
  }
  const scopeCheck = await ensureBoutiqueInScope(
    args.viewer,
    args.query.boutiqueId
  );
  if (!scopeCheck.success) {
    return scopeCheck;
  }
  return loadRegistreWithSignature(args);
}

/**
 * Verifie le scope boutique du viewer. Retourne `BOUTIQUE_NOT_FOUND` si
 * la boutique cible n'est pas dans le scope (anti-enum).
 */
async function ensureBoutiqueInScope(
  viewer: SessionUser,
  boutiqueId: string
): Promise<Result<true, ExportError>> {
  const accessible = await getAccessibleBoutiqueIds(viewer);
  if (!accessible.includes(boutiqueId)) {
    return { success: false, error: 'BOUTIQUE_NOT_FOUND' };
  }
  return { success: true, data: true };
}

interface RegistreQueriesBase {
  readonly boutique: BoutiqueRow | null;
  readonly equipements: EquipementWithReleves[];
  readonly alertesRows: AlerteRow[];
}

async function fetchRegistreBaseQueries(
  query: ExportPdfQuery
): Promise<RegistreQueriesBase> {
  const date = parseISODateUtc(query.date);
  // Perf : les 3 queries sont independantes (la boutique est lue par PK,
  // l'equipement embarque ses releves du jour, alerte n'a pas besoin
  // d'equipement). On parallelise toutes les queries pour reduire la
  // latence end-to-end (audit perf M-3).
  const [boutique, equipements, alertesRows] = await Promise.all([
    db.boutique.findUnique({
      where: { id: query.boutiqueId },
      select: { id: true, nom: true, adresse: true, ville: true },
    }),
    db.equipement.findMany({
      where: { boutiqueId: query.boutiqueId, actif: true },
      orderBy: { nom: 'asc' },
      select: EQUIPEMENT_REGISTRE_SELECT(date),
    }),
    db.alerte.findMany({
      where: { releve: { boutiqueId: query.boutiqueId, date } },
      orderBy: { createdAt: 'asc' },
      select: ALERTE_REGISTRE_SELECT,
    }),
  ]);
  return { boutique, equipements, alertesRows };
}

async function loadRegistreBase(
  args: RegistreBaseArgs
): Promise<Result<RegistreJournalier, ExportError>> {
  const { boutique, equipements, alertesRows } = await fetchRegistreBaseQueries(
    args.query
  );
  if (!boutique) {
    return { success: false, error: 'BOUTIQUE_NOT_FOUND' };
  }
  return {
    success: true,
    data: assembleRegistre({
      query: args.query,
      performedByName: args.performedByName,
      performedByRole: args.performedByRole,
      queries: { boutique, equipements, alertesRows },
    }),
  };
}

async function loadRegistreWithSignature(
  args: BuildRegistreJournalierArgs
): Promise<Result<RegistreJournalierForExport, ExportError>> {
  const date = parseISODateUtc(args.query.date);
  const [boutique, equipements, alertesRows, signatureResult] =
    await Promise.all([
      db.boutique.findUnique({
        where: { id: args.query.boutiqueId },
        select: { id: true, nom: true, adresse: true, ville: true },
      }),
      db.equipement.findMany({
        where: { boutiqueId: args.query.boutiqueId, actif: true },
        orderBy: { nom: 'asc' },
        select: EQUIPEMENT_REGISTRE_SELECT(date),
      }),
      db.alerte.findMany({
        where: { releve: { boutiqueId: args.query.boutiqueId, date } },
        orderBy: { createdAt: 'asc' },
        select: ALERTE_REGISTRE_SELECT,
      }),
      getSignatureForRegistre({
        viewer: args.viewer,
        boutiqueId: args.query.boutiqueId,
        dateISO: args.query.date,
      }),
    ]);
  if (!boutique) {
    return { success: false, error: 'BOUTIQUE_NOT_FOUND' };
  }
  const base = assembleRegistre({
    query: args.query,
    performedByName: args.performedByName,
    performedByRole: args.performedByRole,
    queries: { boutique, equipements, alertesRows },
  });
  return {
    success: true,
    data: { ...base, signature: projectSignatureForPdf(signatureResult) },
  };
}

interface BoutiqueRow {
  readonly id: string;
  readonly nom: string;
  readonly adresse: string | null;
  readonly ville: string | null;
}

interface AssembleRegistreArgs {
  readonly query: ExportPdfQuery;
  readonly performedByName: string;
  readonly performedByRole: string;
  readonly queries: {
    readonly boutique: BoutiqueRow;
    readonly equipements: EquipementWithReleves[];
    readonly alertesRows: AlerteRow[];
  };
}

function assembleRegistre({
  query,
  performedByName,
  performedByRole,
  queries,
}: AssembleRegistreArgs): RegistreJournalier {
  return {
    dateISO: query.date,
    boutique: {
      id: queries.boutique.id,
      nom: queries.boutique.nom,
      adresse: queries.boutique.adresse,
      ville: queries.boutique.ville,
    },
    generatedBy: { nom: performedByName, role: performedByRole },
    generatedAt: new Date(),
    equipements: queries.equipements.map(toRegistreRow),
    alertes: queries.alertesRows.map(toAlerteEntry),
  };
}

function toRegistreRow(eq: EquipementWithReleves): RegistreJournalierRow {
  return {
    equipementId: eq.id,
    equipementNom: eq.nom,
    equipementType: eq.type,
    seuilMin: eq.seuilMin,
    seuilMax: eq.seuilMax,
    creneaux: buildCreneauxForDay(eq.releves),
  };
}

function toAlerteEntry(alerte: AlerteRow): RegistreJournalierAlerteEntry {
  return {
    alerteId: alerte.id,
    equipementNom: alerte.releve.equipement.nom,
    creneau: alerte.releve.creneau,
    temperature: alerte.releve.temperature,
    seuilMin: alerte.releve.equipement.seuilMin,
    seuilMax: alerte.releve.equipement.seuilMax,
    status: alerte.status,
    commentaireResolution: alerte.commentaireResolution,
    resoluParNom: alerte.resoluPar?.name ?? null,
    resoluAt: alerte.resoluAt,
  };
}

const EQUIPEMENT_REGISTRE_SELECT = (date: Date) =>
  ({
    id: true,
    nom: true,
    type: true,
    seuilMin: true,
    seuilMax: true,
    releves: {
      where: { date, annuleParId: null },
      select: {
        creneau: true,
        temperature: true,
        commentaire: true,
        alerteHorsSeuils: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    },
  }) as const;

const ALERTE_REGISTRE_SELECT = {
  id: true,
  status: true,
  commentaireResolution: true,
  resoluAt: true,
  resoluPar: { select: { name: true } },
  releve: {
    select: {
      creneau: true,
      temperature: true,
      equipement: {
        select: { nom: true, seuilMin: true, seuilMax: true },
      },
    },
  },
} as const;

interface EquipementWithReleves {
  readonly id: string;
  readonly nom: string;
  readonly type: 'CONGELATEUR' | 'VITRINE' | 'CHAMBRE_FROIDE' | 'AUTRE';
  readonly seuilMin: number;
  readonly seuilMax: number;
  readonly releves: readonly {
    readonly creneau: 'MATIN' | 'MIDI' | 'SOIR';
    readonly temperature: number;
    readonly commentaire: string | null;
    readonly alerteHorsSeuils: boolean;
    readonly createdAt: Date;
    readonly user: { readonly name: string };
  }[];
}

interface AlerteRow {
  readonly id: string;
  readonly status: 'OUVERTE' | 'RESOLUE' | 'IGNOREE';
  readonly commentaireResolution: string | null;
  readonly resoluAt: Date | null;
  readonly resoluPar: { readonly name: string } | null;
  readonly releve: {
    readonly creneau: 'MATIN' | 'MIDI' | 'SOIR';
    readonly temperature: number;
    readonly equipement: {
      readonly nom: string;
      readonly seuilMin: number;
      readonly seuilMax: number;
    };
  };
}

/**
 * Projette le `Result<SignatureRow | null>` du service signature en
 * `RegistreJournalierSignature | null` pour le PDF.
 *
 * Si la lecture signature echoue (scope hors perimetre ou exception
 * inattendue), on renvoie `null` -> le PDF affichera "Registre non
 * signe". On evite ainsi de faire echouer la generation du registre
 * complet a cause de la signature (decoration optionnelle).
 */
function projectSignatureForPdf(
  result: Awaited<ReturnType<typeof getSignatureForRegistre>>
): RegistreJournalierSignature | null {
  if (!result.success || !result.data) {
    return null;
  }
  return signatureRowToPdfSignature(result.data);
}

function signatureRowToPdfSignature(
  row: SignatureRow
): RegistreJournalierSignature {
  return {
    imageUrl: row.imageUrl,
    signataireName: row.signataireName,
    signataireRoleSnapshot: row.signataireRoleSnapshot,
    signedAt: row.signedAt,
  };
}

const CRENEAUX_ORDER = ['MATIN', 'MIDI', 'SOIR'] as const;

function buildCreneauxForDay(
  releves: readonly {
    readonly creneau: 'MATIN' | 'MIDI' | 'SOIR';
    readonly temperature: number;
    readonly commentaire: string | null;
    readonly alerteHorsSeuils: boolean;
    readonly createdAt: Date;
    readonly user: { readonly name: string };
  }[]
): readonly RegistreJournalierCreneau[] {
  const byCreneau = new Map(releves.map((r) => [r.creneau, r]));
  return CRENEAUX_ORDER.map((slot) => {
    const releve = byCreneau.get(slot);
    if (!releve) {
      return {
        creneau: slot,
        temperature: null,
        commentaire: null,
        alerteHorsSeuils: false,
        salarieNom: null,
        heureSaisie: null,
      };
    }
    return {
      creneau: slot,
      temperature: releve.temperature,
      commentaire: releve.commentaire,
      alerteHorsSeuils: releve.alerteHorsSeuils,
      salarieNom: releve.user.name,
      heureSaisie: PARIS_HOUR_MINUTE.format(releve.createdAt),
    };
  });
}

interface LogExportSuccessArgs {
  readonly viewer: SessionUser;
  readonly performedByName: string;
  readonly format: ExportFormat;
  readonly rowCount: number;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly boutiqueId?: string | null;
  readonly equipementId?: string | null;
}

/**
 * Trace un export reussi dans `AuditLog`.
 *
 * Encoding apres migration `add_audit_export_enum` :
 *   - `action = EXPORT` (semantique propre, plus de hack CREATE/USER).
 *   - `entityType = EXPORT` (type d'entite distinct ; permet a un audit
 *     DDPP de filtrer `entityType=USER` sans melanger creations de
 *     comptes et exports).
 *   - `entityId` = UUID genere ad-hoc : un export n'est pas une entite
 *     stockee (aucune table `Export`), mais le schema impose un
 *     `entityId` non-null. On reserve un identifiant unique par export
 *     pour permettre une traceabilite ligne-a-ligne et un eventuel join
 *     futur si on stocke les exports.
 *   - `entityLabel` : "Export {format} {dateFrom} -> {dateTo}" (lisible).
 *   - `metadata` : details JSON (format, rowCount, scope) sans le hack
 *     `kind: 'EXPORT'` (l'enum suffit maintenant).
 */
export async function logExportSuccess({
  viewer,
  performedByName,
  format,
  rowCount,
  dateFrom,
  dateTo,
  boutiqueId,
  equipementId,
}: LogExportSuccessArgs): Promise<void> {
  try {
    await logAudit({
      action: 'EXPORT',
      entityType: 'EXPORT',
      entityId: crypto.randomUUID(),
      entityLabel: `Export ${format} ${dateFrom} -> ${dateTo}`,
      performedById: viewer.id,
      metadata: {
        format,
        rowCount,
        dateFrom,
        dateTo,
        boutiqueId: boutiqueId ?? null,
        equipementId: equipementId ?? null,
        performedByName,
      },
    });
  } catch (error) {
    logger.error('[export.service] audit log failed', {
      viewerId: viewer.id,
      format,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}
