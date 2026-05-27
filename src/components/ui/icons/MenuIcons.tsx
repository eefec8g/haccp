/**
 * Icones partagees pour les controles de navigation mobile (drawer,
 * burger button, FAB admin/app).
 *
 * Extraites du duplicat repere dans `AppMobileNavDrawer`,
 * `AppMobileNavButton` et `AdminMobileMenu` (Epic RESPONSIVE Phase 3
 * Clean Code Review).
 *
 * Conventions :
 *   - `aria-hidden="true"` : labels d'accessibilite delegues au bouton
 *     parent (`aria-label="Ouvrir le menu"`, etc.).
 *   - `currentColor` : adopte automatiquement la couleur du parent
 *     (mg-ivoire sur fond noir, mg-noir sur fond clair, etc.).
 *   - Stroke 1.5 pour rester en accord avec la charte Maison Givre
 *     (traits fins, sobres, sans rondeur excessive).
 */

const ICON_CLASSES = 'h-6 w-6';

export function BurgerIcon() {
  return (
    <svg
      className={ICON_CLASSES}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7h16M4 12h16M4 17h16"
      />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg
      className={ICON_CLASSES}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
