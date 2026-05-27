import type { ExportRange } from '@/types/export';

/**
 * Construction des noms de fichiers exports HACCP.
 *
 * Convention :
 *   - CSV  : `haccp_releves_YYYYMMDD_YYYYMMDD.csv`
 *   - PDF  : `haccp_registre_YYYY-MM-DD_<slug-boutique>.pdf`
 *
 * Le slug supprime accents et caracteres speciaux pour rester compatible
 * avec les filesystems Windows/Unix et l'URL encoding des navigateurs.
 *
 * Pure functions sans I/O : testable en isolation, reutilisable cote
 * Server Action (header Content-Disposition) et tests E2E.
 */

/** Limite defensive pour eviter les noms de fichiers excessifs. */
const SLUG_MAX_LENGTH = 60;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');
}

function compactDate(dateISO: string): string {
  return dateISO.replace(/-/g, '');
}

export function buildCsvFilename(range: ExportRange): string {
  const from = compactDate(range.dateFromISO);
  const to = compactDate(range.dateToISO);
  return `haccp_releves_${from}_${to}.csv`;
}

export function buildPdfFilename(dateISO: string, boutiqueNom: string): string {
  const slug = slugify(boutiqueNom);
  return `haccp_registre_${dateISO}_${slug}.pdf`;
}
