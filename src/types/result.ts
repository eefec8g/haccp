/**
 * Discriminated-union Result pour les services. Calque du pattern
 * deja en place dans `auth.service.ts`, extrait ici pour reutilisation
 * cross-module sans coupler les domaines (Clean Code #5 - DIP).
 *
 * Convention :
 *   - success: true  -> data presente
 *   - success: false -> error (literal string ou enum custom)
 */
export type Result<T, E extends string> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };
