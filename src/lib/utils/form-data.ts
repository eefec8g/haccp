/**
 * Lecteurs FormData partages par toutes les Server Actions.
 *
 * Pourquoi un module dedie ?
 *   - `formData.get(key)` retourne `FormDataEntryValue | null` (string ou
 *     File). Chaque Server Action doit donc faire un narrowing manuel
 *     avant de passer la valeur a Zod.
 *   - Ces deux helpers etaient dupliques a l'identique dans `admin-user`,
 *     `admin-boutique` et `admin-equipement` (Clean Code #4 - DRY).
 *
 * Semantique :
 *   - `readRequiredString` : retourne `""` si la valeur n'est pas une
 *     string. Zod se charge ensuite du `min(1)` pour signaler l'absence.
 *   - `readOptionalString`  : trim systematique + bascule sur `undefined`
 *     si la chaine est vide. Permet d'ecrire `schema.optional()` sans
 *     avoir a gerer `""` cote schema. La normalisation au plus proche du
 *     bord du systeme evite que `""` ne se propage en DB.
 */

export function readRequiredString(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw : '';
}

export function readOptionalString(
  formData: FormData,
  key: string
): string | undefined {
  const raw = formData.get(key);
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}
