import { logoutAction } from '@/app/actions/logout';

interface LogoutButtonProps {
  readonly label?: string;
  readonly className?: string;
}

const DEFAULT_LABEL = 'Se deconnecter';

const DEFAULT_CLASSNAME =
  'inline-flex items-center justify-center rounded-[7px] border border-[#DFE5EF] bg-white px-4 py-2 text-sm font-semibold text-[#2A3547] transition-colors hover:bg-[#ECF2FF] hover:text-[#5D87FF] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2';

/**
 * Bouton de deconnexion (Server Component).
 *
 * Pourquoi un Server Component + form action ?
 *   - Fonctionne sans JavaScript (progressive enhancement).
 *   - Pas de hydratation client inutile pour une action terminale.
 *   - L'accessibilite est portee par les attributs natifs (button submit).
 *
 * a11y :
 *   - `<button type="submit">` natif (keyboard + screen reader).
 *   - `aria-label` redondant avec le label visible mais explicite la cible.
 *   - Focus visible via `focus:ring-2` Tailwind.
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
