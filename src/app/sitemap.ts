import type { MetadataRoute } from 'next';

/** URL canonique de production, surchargeable via APP_BASE_URL. */
const DEFAULT_BASE_URL = 'https://maison-givre.fr';

/**
 * Sitemap XML pour les robots de moteurs de recherche (Next.js convention).
 *
 * Liste uniquement les pages publiques indexables : la home vitrine et
 * les pages legales (mentions, confidentialite). L'app interne (admin,
 * releves, auth) est explicitement exclue via robots.ts.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.APP_BASE_URL ?? DEFAULT_BASE_URL;
  const lastModified = new Date();

  return [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: 'monthly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/mentions-legales`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/confidentialite`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
