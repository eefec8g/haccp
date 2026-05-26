import type { NextConfig } from 'next';

/**
 * Content-Security-Policy applique a l'ensemble des routes.
 *
 * Notes :
 *   - `'unsafe-inline'` + `'unsafe-eval'` sur `script-src` sont requis
 *     par les helpers Next.js (App Router) pour le client runtime + RSC
 *     payloads. A re-evaluer si une nonce strategy est introduite.
 *   - `style-src 'unsafe-inline'` est requis par Tailwind injecte cote
 *     serveur + styles inline des composants.
 *   - `img-src https:` autorise les images Next/Image distantes + les
 *     data: URIs (icons inline emails).
 *   - `font-src https://fonts.gstatic.com` couvre Google Fonts (charte
 *     Maison Givre) ; `data:` pour les fonts inline emails.
 *   - `connect-src 'self'` : pas d'appel cross-origin frontend pour
 *     l'instant (Resend est appele cote serveur).
 */
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "img-src 'self' data: https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self'",
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'Content-Security-Policy', value: CSP_DIRECTIVES },
        ],
      },
    ];
  },
};

export default nextConfig;
