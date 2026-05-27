/**
 * Helper factorise pour resoudre un code d'erreur URL en message FR
 * a partir d'une table de correspondance.
 *
 * Avant cette extraction, `export-error-messages.ts` et
 * `export-consolide-error-messages.ts` dupliquaient EXACTEMENT le meme
 * code (lookup table + fallback + concat retry). Clean Code #4 (DRY).
 *
 * Design :
 *   - Generique sur le type de cles (`Code extends string`) pour
 *     conserver la securite typage cote appelant.
 *   - Pas d'i18n ici (l'app est mono-langue FR), juste un lookup pur.
 */

const FALLBACK_KEY = 'internal';

/**
 * Code URL emis par les Route Handlers pour signaler un rate-limit. Le
 * caller fournit la valeur exacte du code dans son namespace.
 */
export type ResolveErrorRetry = string | undefined;

/**
 * Resout un code d'erreur URL en message FR pret a afficher.
 *
 * @param table    table de correspondance `code -> message FR`
 * @param error    code emis par le Route Handler (`?error=<code>`)
 * @param retry    duree d'attente facultative (`?retry=2m`) -- concat
 *                 en suffixe humanise si `error === rateLimitedCode`
 * @param rateLimitedCode  code specifique de la table qui declenche le
 *                 suffixe `Patientez X.`
 * @returns message FR ou `undefined` si `error` est absent
 *
 * Si le code n'existe pas dans la table, fallback sur la cle `internal`
 * (presente par convention dans toutes les tables d'erreur export).
 */
export function resolveErrorFromTable<Code extends string>(
  table: Readonly<Record<Code, string>>,
  error: string | undefined,
  retry: ResolveErrorRetry,
  rateLimitedCode: Code
): string | undefined {
  if (!error) {
    return undefined;
  }
  const candidate = (table as Readonly<Record<string, string>>)[error];
  const base = candidate ?? table[FALLBACK_KEY as Code];
  if (error === rateLimitedCode && retry) {
    return `${base} Patientez ${retry}.`;
  }
  return base;
}
