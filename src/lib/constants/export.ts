import type { ExportCsvRow } from '@/types/export';

/**
 * Constantes de l'Epic EXPORT.
 *
 * Bornes operationnelles : evitent l'OOM sur Vercel serverless
 * (limite 250MB Hobby, 1GB Pro) et un audit DDPP avec un export
 * trop volumineux pour etre relu.
 */

export const MAX_EXPORT_RANGE_DAYS = 90;
/**
 * Plafond du nombre de lignes par export CSV.
 *
 * Reduit a 5_000 (audit perf C1) : sur Vercel Hobby (250 MB heap), un
 * export de 10_000 lignes empilait ~30-60 MB en RAM transitoire
 * (Prisma include + map -> projection + csv-stringify + Response body),
 * borderline OOM sous concurrence. 5_000 lignes restent largement
 * suffisantes pour un audit DDPP (90 j x 10 equipements x 3 creneaux
 * = 2_700 lignes). Streaming envisage Phase 2 si besoin de plus.
 */
export const MAX_EXPORT_ROWS = 5_000;

export const CSV_MIME_TYPE = 'text/csv';
export const PDF_MIME_TYPE = 'application/pdf';

/**
 * Colonnes du CSV exporte (ordre fige pour stabilite audit/parsing
 * tiers). Les headers sont en FR. Delimiteur `;` pour compat Excel FR.
 */
export interface CsvColumnDef {
  readonly key: keyof ExportCsvRow;
  readonly header: string;
}

export const CSV_COLUMNS: readonly CsvColumnDef[] = [
  { key: 'date', header: 'Date' },
  { key: 'creneau', header: 'Creneau' },
  { key: 'equipementNom', header: 'Equipement' },
  { key: 'boutiqueNom', header: 'Boutique' },
  { key: 'temperature', header: 'Temperature (degC)' },
  { key: 'seuilMin', header: 'Seuil min (degC)' },
  { key: 'seuilMax', header: 'Seuil max (degC)' },
  { key: 'alerteHorsSeuils', header: 'Hors seuils' },
  { key: 'commentaire', header: 'Commentaire' },
  { key: 'signature', header: 'Signature' },
  { key: 'salarieNom', header: 'Salarie' },
  { key: 'statut', header: 'Statut' },
  { key: 'motifAnnulation', header: "Motif d'annulation" },
] as const;

/**
 * Labels FR utilises dans le PDF "Registre journalier" (audit DDPP).
 */
export const PDF_BRAND_NAME = 'MAISON GIVRE';
export const PDF_BRAND_TAGLINE = 'GLACIER ARTISAN';
export const PDF_TITLE = 'REGISTRE JOURNALIER';
export const PDF_SUBTITLE = 'Releves de temperature HACCP';
export const PDF_ALERTES_SECTION_TITLE = 'Alertes du jour';
export const PDF_NO_ALERTES_LABEL =
  'Aucune alerte enregistree pour cette journee.';
export const PDF_NO_RELEVES_LABEL =
  'Aucun releve enregistre pour cette journee.';
export const PDF_FOOTER_PREFIX = 'Genere par';

/**
 * Couleurs de la charte Maison Givre, en hex valides pour pdfmake.
 */
export const PDF_COLOR_NOIR = '#0D0D0D';
export const PDF_COLOR_OR = '#C6A46C';
export const PDF_COLOR_NOIR_60 = '#666666';

/**
 * Header creneau et statut FR pour le PDF.
 */
export const CRENEAU_PDF_LABELS: Readonly<
  Record<'MATIN' | 'MIDI' | 'SOIR', string>
> = {
  MATIN: 'Matin',
  MIDI: 'Midi',
  SOIR: 'Soir',
};

export const ALERTE_STATUS_PDF_LABELS: Readonly<
  Record<'OUVERTE' | 'RESOLUE' | 'IGNOREE', string>
> = {
  OUVERTE: 'Ouverte',
  RESOLUE: 'Resolue',
  IGNOREE: 'Ignoree',
};
