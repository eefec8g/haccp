import { ImageResponse } from 'next/og';

/** Dimensions du favicon (Next.js convention). */
export const size = { width: 32, height: 32 };

/** Format de sortie du favicon. */
export const contentType = 'image/png';

/**
 * Favicon Maison Givre 32x32 (Next.js convention).
 *
 * Monogramme "MG" or sur fond noir profond, en accord avec la charte
 * graphique (palette mg-noir + mg-or). Genere a la build via next/og
 * (ImageResponse) -> aucun asset binaire dans le repo.
 */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        background: '#0D0D0D',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#C6A46C',
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: '0.1em',
        fontFamily: 'sans-serif',
      }}
    >
      MG
    </div>,
    { ...size }
  );
}
