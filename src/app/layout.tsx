import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HACCP - Maison Givre',
  description: 'Releves de temperature HACCP pour Maison Givre',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
