/**
 * Formatte une temperature en chaine `XX.X degC` pour l'affichage UI,
 * emails et exports PDF.
 *
 * Centralise le format unique HACCP (1 decimale + suffixe `degC`) pour
 * eviter les divergences cross-fichiers (CC-4 DRY). Auparavant duplique
 * dans `ReleveListingTable`, `boutiques/.../registre/[dateISO]/page`,
 * `email-alerte.service` et `pdf-builder`.
 *
 * - `value` : temperature en degres Celsius. `null` / `undefined` ->
 *   renvoie `placeholder`.
 * - `placeholder` : substitution pour `null`/`undefined`. Defaut em-dash
 *   (`—`) qui suit la charte Maison Givre (pas de tiret bas ASCII dans
 *   les exports clients). Les contextes "ASCII-only" (PDF kit sans embed
 *   font, emails plain text) peuvent passer `'-'`.
 *
 * Pur (pas d'IO, pas de Date.now, pas de Math.random) -- testable
 * deterministe et compatible Server + Client Components.
 */
export const TEMPERATURE_PLACEHOLDER_DEFAULT = '—';

export function formatTemperature(
  value: number | null | undefined,
  placeholder: string = TEMPERATURE_PLACEHOLDER_DEFAULT
): string {
  if (value === null || value === undefined) {
    return placeholder;
  }
  return `${value.toFixed(1)} degC`;
}
