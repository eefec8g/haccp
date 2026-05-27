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
import { logger } from '@/lib/logger';
import type {
  ExportCsvRow,
  ExportError,
  ExportFormat,
  RegistreJournalier,
  RegistreJournalierAlerteEntry,
  RegistreJournalierCreneau,
  RegistreJournalierRow,
} from '@/types/export';
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

export async function buildRegistreJournalier({
  viewer,
  query,
  performedByName,
  performedByRole,
}: BuildRegistreJournalierArgs): Promise<
  Result<RegistreJournalier, ExportError>
> {
  if (!canExport(viewer)) {
    return { success: false, error: 'FORBIDDEN' };
  }
  const accessible = await getAccessibleBoutiqueIds(viewer);
  if (!accessible.includes(query.boutiqueId)) {
    return { success: false, error: 'BOUTIQUE_NOT_FOUND' };
  }
  const boutique = await db.boutique.findUnique({
    where: { id: query.boutiqueId },
    select: { id: true, nom: true, adresse: true, ville: true },
  });
  if (!boutique) {
    return { success: false, error: 'BOUTIQUE_NOT_FOUND' };
  }
  const date = parseISODateUtc(query.date);
  // Perf : les 2 queries sont independantes (l'equipement embarque ses
  // releves du jour, alerte n'a pas besoin d'equipement). On parallelise
  // apres le check boutique (qui reste sequentiel car c'est un gating).
  const [equipements, alertesRows] = await Promise.all([
    db.equipement.findMany({
      where: { boutiqueId: query.boutiqueId, actif: true },
      orderBy: { nom: 'asc' },
      select: {
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
      },
    }),
    db.alerte.findMany({
      where: { releve: { boutiqueId: query.boutiqueId, date } },
      orderBy: { createdAt: 'asc' },
      select: {
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
      },
    }),
  ]);
  const equipementRows: RegistreJournalierRow[] = equipements.map((eq) => ({
    equipementId: eq.id,
    equipementNom: eq.nom,
    equipementType: eq.type,
    seuilMin: eq.seuilMin,
    seuilMax: eq.seuilMax,
    creneaux: buildCreneauxForDay(eq.releves),
  }));
  const alerteEntries: RegistreJournalierAlerteEntry[] = alertesRows.map(
    (alerte) => ({
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
    })
  );
  return {
    success: true,
    data: {
      dateISO: query.date,
      boutique: {
        id: boutique.id,
        nom: boutique.nom,
        adresse: boutique.adresse,
        ville: boutique.ville,
      },
      generatedBy: { nom: performedByName, role: performedByRole },
      generatedAt: new Date(),
      equipements: equipementRows,
      alertes: alerteEntries,
    },
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
