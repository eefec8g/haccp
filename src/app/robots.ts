import type { MetadataRoute } from 'next';

/** URL canonique de production, surchargeable via APP_BASE_URL. */
const DEFAULT_BASE_URL = 'https://maison-givre.fr';

/**
 * Fichier robots.txt genere (Next.js convention).
 *
 * Autorise la vitrine publique mais bloque toutes les routes de l'app
 * interne (admin, API, auth) ainsi que l'espace releves operatoire.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.APP_BASE_URL ?? DEFAULT_BASE_URL;

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/login',
          '/forgot-password',
          '/reset-password',
          '/accept-invitation',
          '/releves',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
