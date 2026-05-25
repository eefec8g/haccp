import type { Metadata } from 'next';
import {
  LandingHeader,
  HeroSection,
  ValeursSection,
  PiliersSection,
  HistoireSection,
  CTASection,
  LandingFooter,
} from '@/features/landing';

export const metadata: Metadata = {
  title: 'Maison Givre - Glacier Artisan depuis 1933',
  description:
    "Maison Givre, glacier artisan depuis 1933. Glaces et sorbets d'exception, fabrication artisanale, ingredients selectionnes. Maison familiale, trois generations.",
};

/**
 * Page d'accueil publique - vitrine Maison Givre (Server Component).
 *
 * Structure premium en 6 sections : hero immersif, valeurs, savoir-faire
 * (4 piliers), histoire, contact et footer. Accessible sans
 * authentification (cf. ALWAYS_PUBLIC_PATHS du middleware). Les CTAs
 * contextuels (Espace pro vs Acceder a mon espace) sont resolus
 * cote serveur par auth() dans chaque section concernee.
 */
export default function HomePage() {
  return (
    <>
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
