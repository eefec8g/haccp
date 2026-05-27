import Link from 'next/link';
import type { Route } from 'next';
import { MG_GHOST_BUTTON_CLASSES } from '@/lib/constants/styles';

/**
 * RefreshButton - Lien "Actualiser" du dashboard (Server Component).
 *
 * Recharge la page courante en ajoutant un parametre `t` (timestamp) au
 * querystring : Next.js considere alors une nouvelle URL et re-rend le
 * Server Component (decision Epic : pas de cache, refresh manuel).
 *
 * On utilise un Link plutot qu'un bouton + Server Action pour rester
 * 100% Server Component (Phase 1 socle). Le `<Link>` est focus-visible
 * (ring or) et accessible au clavier.
 *
 * Style : reutilise `MG_GHOST_BUTTON_CLASSES` (charte Maison Givre,
 * Clean Code #4 DRY).
 *
 * Note Phase 2 : si on ajoute un drill-down avec query params (boutique,
 * date), il faudra preserver le querystring courant dans `href` plutot
 * que d'ecraser. Cette responsabilite incombe alors aux pages
 * appelantes (passer `href` calcule).
 */

interface RefreshButtonProps {
  /** Chemin courant a re-cibler (typed Route). */
  readonly href: Route;
  /** Libelle du lien (defaut : "Actualiser"). */
  readonly label?: string;
  /** `data-testid` (defaut : refresh-button). */
  readonly testId?: string;
}

export function RefreshButton({
  href,
  label = 'Actualiser',
  testId,
}: RefreshButtonProps) {
  return (
    <Link
      href={href}
      className={MG_GHOST_BUTTON_CLASSES}
      data-testid={testId ?? 'refresh-button'}
      aria-label={label}
    >
      <span aria-hidden="true">&#x21BB;</span>
      <span>{label}</span>
    </Link>
  );
}
