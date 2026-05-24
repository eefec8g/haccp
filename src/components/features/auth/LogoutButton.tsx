import { logoutAction } from '@/app/actions/logout';

interface LogoutButtonProps {
  readonly label?: string;
  readonly className?: string;
}

const DEFAULT_LABEL = 'Se deconnecter';

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
  const buttonClassName =
    className ??
    'text-sm px-3 py-2 rounded-md border border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500';

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
