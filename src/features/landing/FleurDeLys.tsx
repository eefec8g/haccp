import { BRAND_COLORS } from '@/lib/constants/brand';

interface FleurDeLysProps {
  readonly size?: number;
  readonly color?: string;
  readonly className?: string;
}

/**
 * Fleur de lys stylisee (Server Component).
 *
 * Element decoratif premium utilise comme separateur de section ou marqueur
 * d'heritage. Forme heraldique simplifiee : bouton central + 2 petales
 * lateraux courbes + bandeau horizontal au tiers inferieur.
 *
 * Decoratif uniquement -> aria-hidden par defaut, sauf si className indique
 * un contexte semantique (laisse a l'appelant).
 */
export function FleurDeLys({
  size = 24,
  color = BRAND_COLORS.or,
  className,
}: FleurDeLysProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 40"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Petale central pointu */}
      <path
        d="M 16 2 Q 13 12 16 22 Q 19 12 16 2 Z"
        fill={color}
        stroke={color}
        strokeWidth="0.5"
      />
      {/* Petale gauche courbe */}
      <path
        d="M 16 12 Q 6 10 4 22 Q 10 20 16 16 Z"
        fill={color}
        opacity="0.85"
      />
      {/* Petale droit courbe */}
      <path
        d="M 16 12 Q 26 10 28 22 Q 22 20 16 16 Z"
        fill={color}
        opacity="0.85"
      />
      {/* Bandeau central */}
      <rect x="6" y="22" width="20" height="2.5" rx="1" fill={color} />
      {/* Pied central */}
      <path
        d="M 16 24 Q 14 32 16 38 Q 18 32 16 24 Z"
        fill={color}
        opacity="0.9"
      />
    </svg>
  );
}
