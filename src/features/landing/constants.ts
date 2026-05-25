/**
 * Constantes locales a la vitrine Maison Givre.
 *
 * Les chaines de marque (nom, tagline, story, piliers, contact)
 * vivent dans `@/lib/constants/brand.ts`. Ce fichier ne contient que les
 * types et helpers de structure utilises par les sections de la vitrine.
 */

import type { Route } from 'next';

export interface FooterLinkItem {
  readonly label: string;
  readonly href: Route | string;
  readonly external?: boolean;
}

export interface FooterLinkGroup {
  readonly title: string;
  readonly links: readonly FooterLinkItem[];
}

export const FOOTER_BRAND_TAGLINE =
  'Glacier artisan. Une maison familiale, trois generations, un seul savoir-faire.';

export const FOOTER_LINK_GROUPS: readonly FooterLinkGroup[] = [
  {
    title: 'MAISON',
    links: [
      { label: 'Savoir-faire', href: '#savoir-faire' },
      { label: 'Notre histoire', href: '#histoire' },
      { label: 'Contact', href: '#contact' },
    ],
  },
  {
    title: 'LEGAL',
    links: [
      { label: 'Mentions legales', href: '/mentions-legales' as Route },
      { label: 'Confidentialite', href: '/confidentialite' as Route },
      { label: 'Cookies', href: '/cookies' as Route },
    ],
  },
  {
    title: 'SUIVEZ-NOUS',
    links: [
      {
        label: 'Instagram',
        href: 'https://instagram.com/maisongivre',
        external: true,
      },
      {
        label: 'Pinterest',
        href: 'https://pinterest.com/maisongivre',
        external: true,
      },
    ],
  },
];
