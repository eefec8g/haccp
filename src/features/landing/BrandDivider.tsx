import { BRAND_COLORS } from '@/lib/constants/brand';

export type BrandDividerWidth = 'small' | 'medium' | 'large';

interface BrandDividerProps {
  readonly width?: BrandDividerWidth;
  readonly withDot?: boolean;
  readonly color?: string;
  readonly className?: string;
}

const WIDTH_TO_PX: Record<BrandDividerWidth, number> = {
  small: 32,
  medium: 60,
  large: 120,
};

/**
 * Separateur decoratif Maison Givre (Server Component).
 *
 * Trait horizontal fin (1px) or, optionnellement coupe par un point central.
 * Toujours decoratif (aria-hidden). Utilise sous les titres ou pour separer
 * deux blocs textuels dans une meme section.
 */
export function BrandDivider({
  width = 'medium',
  withDot = false,
  color = BRAND_COLORS.or,
  className,
}: BrandDividerProps) {
  const widthPx = WIDTH_TO_PX[width];
  const halfWidth = widthPx / 2 - (withDot ? 6 : 0);

  if (!withDot) {
    return (
      <span
        aria-hidden="true"
        className={className}
        style={{
          display: 'inline-block',
          width: `${widthPx}px`,
          height: '1px',
          backgroundColor: color,
        }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: `${halfWidth}px`,
          height: '1px',
          backgroundColor: color,
        }}
      />
      <span
        style={{
          display: 'inline-block',
          width: '4px',
          height: '4px',
          borderRadius: '50%',
          backgroundColor: color,
        }}
      />
      <span
        style={{
          display: 'inline-block',
          width: `${halfWidth}px`,
          height: '1px',
          backgroundColor: color,
        }}
      />
    </span>
  );
}
