import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Releves - HACCP Maison Givre',
  robots: { index: false, follow: false },
};

/**
 * Page `/releves` (segment nu).
 *
 * La vue "tournee du jour" en cartes (TourneeGrid) faisait doublon avec le
 * `/dashboard`, qui presente deja le tableau equipements x creneaux du jour
 * et les acces aux tournees matin/midi/soir. La page est donc reduite a une
 * redirection serveur vers le dashboard : on conserve le segment resolvable
 * (pas de 404 sur acces direct ou bookmark) tout en supprimant la vue
 * redondante. Les sous-routes (`/releves/listing`, `/releves/historique`,
 * `/releves/registre`, `/releves/tournee/[creneau]`, etc.) restent valides.
 */
export default function RelevesPage(): never {
  redirect('/dashboard');
}
