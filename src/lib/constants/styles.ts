/**
 * Classes Tailwind partagees de la charte Maison Givre.
 *
 * Centralisees pour eviter les duplications cross-fichiers (Clean Code
 * #4 DRY). N'expose QUE des patterns reutilises >= 2 fois dans le
 * codebase. Un pattern utilise une seule fois reste inline pour eviter
 * l'over-abstraction.
 *
 * Convention de nommage : prefixe `MG_` (Maison Givre) + role.
 */

/**
 * Bouton/lien "ghost" : bordure subtile, fond transparent, hover en or.
 * Utilise pour les actions secondaires (RefreshButton, Appliquer, ...).
 */
export const MG_GHOST_BUTTON_CLASSES =
  'inline-flex items-center gap-2 border border-mg-noir/20 bg-transparent px-4 py-2 text-[10px] font-medium uppercase tracking-[0.3em] text-mg-noir transition-colors hover:border-mg-or hover:text-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';

/**
 * Eyebrow Maison Givre : libelle court en or, lettres espacees,
 * uppercase. Utilise pour les titres de section (`<p>` ou `<h2>`).
 * Pattern duplique a l'identique dans plusieurs composants Epic.
 */
export const MG_EYEBROW_CLASSES =
  'text-[10px] font-medium uppercase tracking-[0.3em] text-mg-or';
