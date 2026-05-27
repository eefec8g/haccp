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
 *   - `img-src 'self' data: https://*.public.blob.vercel-storage.com`
 *     restreint les images HTTPS au seul domaine Vercel Blob (US-PHO-001 :
 *     sec finding M-1). `data:` conserve pour les previews canvas client
 *     (compression photo) + icons inline. Les emails Resend sont externes
 *     et ne sont pas soumis a la CSP de l'app web.
 *   - `font-src https://fonts.gstatic.com` couvre Google Fonts (charte
 *     Maison Givre) ; `data:` pour les fonts inline emails.
 *   - `connect-src 'self'` : pas d'appel cross-origin frontend pour
 *     l'instant (Resend est appele cote serveur).
 */
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "img-src 'self' data: https://*.public.blob.vercel-storage.com",
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
  /**
   * `pdfmake` / `pdfkit` chargent des fichiers de fontes Helvetica via
   * fs (CourierStd-Bold.afm, etc.) au moment de creer le `PdfPrinter`.
   * Next.js essaie de bundler ces requires et echoue. On les classe en
   * "external" pour que le serveur les resolve a runtime depuis
   * `node_modules` (Vercel embarque le tree complet pour les fonctions).
   */
  serverExternalPackages: ['pdfmake'],
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
