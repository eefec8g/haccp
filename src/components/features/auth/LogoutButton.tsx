import { logoutAction } from '@/app/actions/logout';

interface LogoutButtonProps {
  readonly label?: string;
  readonly className?: string;
}

const DEFAULT_LABEL = 'Se deconnecter';

const DEFAULT_CLASSNAME =
  'inline-flex items-center justify-center border border-mg-or/40 bg-transparent px-4 py-2 text-[11px] font-medium uppercase tracking-[0.2em] text-mg-noir transition-colors hover:border-mg-or hover:bg-mg-or hover:text-mg-noir focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';

/**
 * Bouton de deconnexion (Server Component), style Maison Givre.
 *
 * Pourquoi un Server Component + form action ?
 *   - Fonctionne sans JavaScript (progressive enhancement).
 *   - Pas de hydratation client inutile pour une action terminale.
 *   - L'accessibilite est portee par les attributs natifs (button submit).
 *
 * Style : outline or discret pour s'integrer aux headers/layouts sans
 * voler la vedette. Hover plein or sur fond noir/ivoire.
 *
 * a11y :
 *   - `<button type="submit">` natif (keyboard + screen reader).
 *   - `aria-label` redondant avec le label visible mais explicite la cible.
 *   - Focus visible via `focus:ring-1` Tailwind.
 */
export function LogoutButton({
  label = DEFAULT_LABEL,
  className,
}: LogoutButtonProps) {
  const buttonClassName = className ?? DEFAULT_CLASSNAME;

  return (
    <form action={logoutAction}>
      <button
        type="submit"
        aria-label={label}
        className={buttonClassName}
        data-testid="logout-button"
      >
        {label}
      </button>
    </form>
  );
}
