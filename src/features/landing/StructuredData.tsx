import {
  BRAND_BOUTIQUES,
  BRAND_CONTACT,
  BRAND_FOUNDING_YEAR,
} from '@/lib/constants/brand';

/** URL canonique de production, surchargeable via APP_BASE_URL. */
const DEFAULT_BASE_URL = 'https://maison-givre.fr';
const ORGANIZATION_DESCRIPTION =
  'Glacier artisan francais depuis 1933, maison familiale 3 generations.';
const LOCAL_BUSINESS_DESCRIPTION =
  'Glaces et sorbets artisanaux fabriques sur place. Maison familiale depuis 1933.';
const SERVES_CUISINE = 'Glaces et sorbets';
const PRICE_RANGE = '€€';

interface OrganizationLd {
  readonly '@context': 'https://schema.org';
  readonly '@type': 'Organization';
  readonly name: string;
  readonly description: string;
  readonly url: string;
  readonly foundingDate: string;
  readonly email: string;
  readonly sameAs: readonly string[];
}

interface LocalBusinessLd {
  readonly '@context': 'https://schema.org';
  readonly '@type': 'LocalBusiness';
  readonly '@id': string;
  readonly name: string;
  readonly description: string;
  readonly url: string;
  readonly address: {
    readonly '@type': 'PostalAddress';
    readonly streetAddress: string;
    readonly postalCode: string;
    readonly addressLocality: string;
    readonly addressCountry: 'FR';
  };
  readonly servesCuisine: string;
  readonly priceRange: string;
}

function buildOrganization(baseUrl: string): OrganizationLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Maison Givre',
    description: ORGANIZATION_DESCRIPTION,
    url: baseUrl,
    foundingDate: String(BRAND_FOUNDING_YEAR),
    email: BRAND_CONTACT.email,
    sameAs: ['https://instagram.com/maisongivre'],
  };
}

function buildLocalBusiness(
  baseUrl: string,
  boutique: (typeof BRAND_BOUTIQUES)[number]
): LocalBusinessLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${baseUrl}#${boutique.id}`,
    name: `Maison Givre - ${boutique.city}`,
    description: LOCAL_BUSINESS_DESCRIPTION,
    url: baseUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: boutique.street,
      postalCode: boutique.postalCode,
      addressLocality: boutique.city,
      addressCountry: 'FR',
    },
    servesCuisine: SERVES_CUISINE,
    priceRange: PRICE_RANGE,
  };
}

/**
 * Structured Data JSON-LD (Server Component).
 *
 * Expose les schemas Organization + LocalBusiness pour chaque boutique
 * afin d'enrichir la SERP (knowledge graph, rich results local). Rendu
 * inline en <script type="application/ld+json"> dans le head de la page.
 */
export function StructuredData() {
  const baseUrl = process.env.APP_BASE_URL ?? DEFAULT_BASE_URL;
  const data: readonly (OrganizationLd | LocalBusinessLd)[] = [
    buildOrganization(baseUrl),
    ...BRAND_BOUTIQUES.map((boutique) => buildLocalBusiness(baseUrl, boutique)),
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
