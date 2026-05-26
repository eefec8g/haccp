import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';

/**
 * Police officielle Maison Givre : Montserrat (Google Fonts).
 * Charges en self-host via next/font/google pour eviter toute requete
 * cross-origin a l'execution. variable CSS reutilisable via Tailwind.
 */
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Maison Givre - Glacier Artisan depuis 1933',
  description:
    "Maison Givre, glacier artisan parisien depuis 1933. Glaces et sorbets d'exception, fabrication artisanale, ingredients selectionnes. Savoir-faire francais transmis sur trois generations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={montserrat.variable}>
      <body>{children}</body>
    </html>
  );
}
