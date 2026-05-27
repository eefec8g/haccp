/**
 * Helper de formatage de tailles binaires (US-PHO-001 DRY refactor).
 *
 * Centralise pour eviter la duplication de `BYTES_PER_KB` et de helpers
 * quasi-identiques (`formatSizeKB` / `formatKB`) entre `PhotoCard` et
 * `PhotoUploadForm`. Conventions :
 *   - Affichage `KB` arrondi (entier) en dessous de 1 MB.
 *   - Affichage `MB` a 1 decimale au-dela.
 *   - Pas d'option locale i18n (MVP HACCP FR-only, le label "KB" est
 *     consensuel y compris en FR pour des poids de fichiers).
 */

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * 1024;

/**
 * Formate une taille en octets en string lisible : `12 KB`, `1.4 MB`.
 * Seuil MB a partir de 1 MB pour eviter `1024 KB`.
 */
export function formatBytes(bytes: number): string {
  if (bytes < BYTES_PER_MB) {
    return `${Math.round(bytes / BYTES_PER_KB)} KB`;
  }
  return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
}
