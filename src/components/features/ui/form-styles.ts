/**
 * Constantes Tailwind partagees pour les formulaires Epic RELEVE+ALERTE.
 *
 * Extraites pour eliminer la duplication entre :
 *   - SaisieReleveForm (US-REL-002)
 *   - AnnulerReleveForm (US-REL-004)
 *   - ResolutionForm (US-ALE-002)
 *
 * On garde des constantes (et pas des composants wrappers) pour preserver
 * la souplesse d'usage : chaque form garde le controle de ses inputs et
 * peut composer avec ces classes via template strings (ex variantes
 * `TEMPERATURE_INPUT_CLASSES = `${INPUT_CLASSES} text-center text-3xl`).
 *
 * Charte Maison Givre :
 *   - inputs : bordure mg-noir/15, fond mg-ivoire, focus mg-or,
 *   - submit primaire : fond mg-noir, hover mg-or, tracking 0.3em,
 *   - error box : bordure et fond mg-or attenue, texte uppercase 0.15em,
 *   - label : 11px uppercase tracking 0.2em, mg-noir/70.
 *
 * Hors perimetre : formulaires d'auth (`LoginForm`) et formulaires admin
 * (cf. `src/components/features/admin/FormField.tsx`) qui ont leurs
 * propres patterns dedies.
 */

/**
 * Input texte/number/textarea (taille standard, padding 4/3).
 *
 * `min-h-touch` (44px) garantit la cible tactile minimale WCAG 2.1 AA,
 * essentielle en boutique avec gants. Le padding visuel reste inchange.
 */
export const INPUT_CLASSES =
  'block min-h-touch w-full rounded-none border border-mg-noir/15 bg-mg-ivoire px-4 py-3 text-sm font-light text-mg-noir transition-colors placeholder:text-mg-noir/30 focus:border-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or disabled:cursor-not-allowed disabled:bg-mg-noir/5';

/** Input "imposant" pour saisie tactile en environnement froid (h-14, px-6). */
export const INPUT_LARGE_CLASSES =
  'block w-full rounded-none border border-mg-noir/15 bg-mg-ivoire px-6 py-4 text-lg font-light text-mg-noir transition-colors placeholder:text-mg-noir/30 focus:border-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or disabled:cursor-not-allowed disabled:bg-mg-noir/5';

/** Textarea standard - reprend INPUT_CLASSES (les forms peuvent rajouter min-h via composition). */
export const TEXTAREA_CLASSES = INPUT_CLASSES;

/**
 * Bouton submit primaire (fond noir, hover or).
 *
 * `min-h-touch` (44px) garantit la cible tactile minimale WCAG 2.1 AA.
 * Sans cette regle, `py-3` produit ~38px (text 11px), insuffisant.
 */
export const SUBMIT_CLASSES =
  'inline-flex min-h-touch items-center justify-center bg-mg-noir px-8 py-3 text-[11px] font-light uppercase tracking-[0.3em] text-mg-ivoire transition-colors hover:bg-mg-or hover:text-mg-noir focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire disabled:cursor-not-allowed disabled:opacity-60';

/** Bouton submit "imposant" pour formulaires tactiles (h-14, w-full). */
export const SUBMIT_LARGE_CLASSES =
  'inline-flex h-14 w-full items-center justify-center bg-mg-noir px-8 text-[12px] font-medium uppercase tracking-[0.3em] text-mg-ivoire transition-colors hover:bg-mg-or hover:text-mg-noir focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Bouton "destructif" pour annulations (fond or, hover noir).
 * Pas de rouge : la charte Maison Givre utilise le mg-or sature pour
 * exprimer les actions sensibles. `min-h-touch` pour le tactile.
 */
export const SUBMIT_DESTRUCTIVE_CLASSES =
  'inline-flex min-h-touch items-center justify-center bg-mg-or px-8 py-3 text-[11px] font-medium uppercase tracking-[0.3em] text-mg-noir transition-colors hover:bg-mg-noir hover:text-mg-ivoire focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire disabled:cursor-not-allowed disabled:opacity-60';

/** Boite d'erreur globale (role="alert" + aria-live polite). */
export const ERROR_BOX_CLASSES =
  'border border-mg-or/40 bg-mg-or/5 px-4 py-3 text-xs font-light uppercase tracking-[0.15em] text-mg-or';

/** Label de champ form (11px uppercase or). */
export const LABEL_CLASSES =
  'mb-2 block text-[11px] font-medium uppercase tracking-[0.2em] text-mg-noir/70';
