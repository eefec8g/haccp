import { ImageResponse } from 'next/og';

/** Dimensions du icon Apple iOS (Next.js convention). */
export const size = { width: 180, height: 180 };

/** Format de sortie du icon. */
export const contentType = 'image/png';

/**
 * Apple touch icon 180x180 (Next.js convention).
 *
 * Monogramme "MG" or sur fond noir profond pour les ajouts a l'ecran
 * d'accueil iOS. Meme charte que icon.tsx, taille agrandie.
 */
export default function AppleIcon() {
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
        fontSize: 72,
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
