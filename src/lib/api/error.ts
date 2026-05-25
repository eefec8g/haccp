/**
 * Extrait un message d'erreur lisible depuis un `unknown` capture
 * dans un `catch`. TypeScript force `unknown` sur le binding de catch
 * (sain), donc ce helper centralise le narrowing.
 *
 * Pattern aligne sur C8GApp (lib/utils/error.ts).
 */

const DEFAULT_FALLBACK = 'Une erreur est survenue';

/**
 * Si `error` est une instance d'`Error`, retourne `error.message`.
 * Sinon retourne `fallback` (par defaut : message FR generique).
 *
 * On NE convertit PAS l'objet en string (`String(error)`) car cela
 * ferait fuiter des objets internes (stacks, prototypes) dans des
 * logs / reponses non controlees.
 */
export function extractErrorMessage(
  error: unknown,
  fallback: string = DEFAULT_FALLBACK
): string {
  return error instanceof Error ? error.message : fallback;
}
