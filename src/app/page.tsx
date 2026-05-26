import type { Metadata } from 'next';
import {
  LandingHeader,
  HeroSection,
  ValeursSection,
  PiliersSection,
  HistoireSection,
  CTASection,
  LandingFooter,
  StructuredData,
} from '@/features/landing';

const SITE_TITLE = 'Maison Givre - Glacier Artisan depuis 1933';
const SITE_DESCRIPTION =
  "Glaces et sorbets d'exception, fabrication artisanale, maison familiale depuis 1933. Boutiques a Lyon et Strasbourg.";
const TWITTER_DESCRIPTION =
  'Glaces et sorbets artisanaux. Boutiques a Lyon et Strasbourg.';
const OG_IMAGE_URL = '/illustrations/boutique-interieur.jpg';
const OG_IMAGE_ALT = 'Boutique Maison Givre';
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;
const DEFAULT_BASE_URL = 'https://maison-givre.fr';

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  metadataBase: new URL(process.env.APP_BASE_URL ?? DEFAULT_BASE_URL),
  alternates: { canonical: '/' },
  keywords: [
    'glacier',
    'glace artisanale',
    'sorbet',
    'Maison Givre',
    'Lyon',
    'Strasbourg',
    'artisan',
    '1933',
  ],
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Maison Givre',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE_URL,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: OG_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: TWITTER_DESCRIPTION,
    images: [OG_IMAGE_URL],
  },
};

/**
 * Page d'accueil publique - vitrine Maison Givre (Server Component).
 *
 * Structure premium en 6 sections : hero immersif, valeurs, savoir-faire
 * (4 piliers), histoire, contact et footer. Accessible sans
 * authentification (cf. ALWAYS_PUBLIC_PATHS du middleware). Les CTAs
 * contextuels (Espace pro vs Acceder a mon espace) sont resolus
 * cote serveur par auth() dans chaque section concernee.
 *
 * Inclut un bloc JSON-LD Organization + LocalBusiness pour enrichir
 * la SERP (rich results).
 */
export default function HomePage() {
  return (
    <>
      <StructuredData />
      <LandingHeader />
      <main id="main-content">
        <HeroSection />
        <ValeursSection />
        <PiliersSection />
        <HistoireSection />
        <CTASection />
      </main>
      <LandingFooter />
    </>
  );
}
