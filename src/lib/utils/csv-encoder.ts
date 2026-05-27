import { stringify } from 'csv-stringify/sync';
import { CSV_COLUMNS } from '@/lib/constants/export';
import type { ExportCsvRow } from '@/types/export';

/**
 * Encode des lignes `ExportCsvRow` en CSV (delimiteur `;` pour Excel FR).
 *
 * Decisions :
 *   - `csv-stringify/sync` : la generation est en memoire (cf.
 *     `MAX_EXPORT_ROWS = 5_000`) donc le mode async ne gagne rien. Le
 *     sync rend l'API trivialement testable.
 *   - Booleens projetes en `OUI`/`NON` (CCF: convention metier FR).
 *   - `null`/`undefined` -> cellule vide (pas `null` textuel).
 *   - BOM UTF-8 (`U+FEFF`) PREFIXE au body : sans BOM, Excel FR ouvre
 *     les fichiers en latin-1 par defaut et casse les accents (audit
 *     DDPP rejettera un export illisible). Le BOM est consomme par
 *     Excel/LibreOffice et reste invisible pour les autres parsers.
 *   - L'echappement (`;`, `"`, newlines) est delegue a csv-stringify
 *     (RFC 4180 + double-quote escape).
 *   - Cellules `string` prefixees par une apostrophe si la 1ere char
 *     est `=`, `+`, `-`, `@`, `\t`, `\r` : protection contre la CSV
 *     Formula Injection (OWASP, CVSS 7.8). Un commentaire saisi par
 *     un salarie comme `=HYPERLINK("http://evil")` serait sinon
 *     execute par Excel a l'ouverture (RCE locale potentielle).
 *     `number`/`boolean` ne sont pas concernes (pas de prefixe possible).
 *
 * @param rows lignes a encoder (ordre conserve dans la sortie).
 * @returns string CSV "BOM + headers\nrow1\nrow2\n..." (les retours
 *          chariot sont gerees par csv-stringify, CRLF par defaut).
 */

const BOOLEAN_TRUE_LABEL = 'OUI';
const BOOLEAN_FALSE_LABEL = 'NON';
const UTF8_BOM = '﻿';
const FORMULA_INJECTION_PREFIXES: ReadonlySet<string> = new Set([
  '=',
  '+',
  '-',
  '@',
  '\t',
  '\r',
]);

export function escapeCsvCell(value: string): string {
  if (value.length === 0) {
    return value;
  }
  const firstChar = value.charAt(0);
  if (FORMULA_INJECTION_PREFIXES.has(firstChar)) {
    return `'${value}`;
  }
  return value;
}

function projectCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? BOOLEAN_TRUE_LABEL : BOOLEAN_FALSE_LABEL;
  }
  if (typeof value === 'string') {
    return escapeCsvCell(value);
  }
  return String(value);
}

function projectRow(row: ExportCsvRow): readonly string[] {
  return CSV_COLUMNS.map((column) => projectCell(row[column.key]));
}

export function encodeCsv(rows: readonly ExportCsvRow[]): string {
  const headers = CSV_COLUMNS.map((column) => column.header);
  const data = rows.map((row) => projectRow(row));
  return `${UTF8_BOM}${stringify([headers, ...data], { delimiter: ';' })}`;
}
