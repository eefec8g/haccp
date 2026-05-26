import type { Creneau } from '@prisma/client';
import type { TourneeEquipementCard } from '@/types/releve';
import { TourneeCard } from './TourneeCard';

/**
 * Grille des cartes equipement de la tournee du jour (US-REL-001).
 *
 * Server Component pur : rend une carte par equipement (TourneeCard
 * deja code, charte Maison Givre) ou un empty state si aucun
 * equipement n'est accessible/actif. Pas d'etat client, tout est
 * propage en prop (cards + currentCreneau).
 *
 * Layout responsive : 1 colonne mobile, 2 colonnes md+, 3 colonnes
 * lg+ pour permettre une vue d'ensemble RESPONSABLE/ADMIN multi-
 * boutiques sans ascenseur excessif.
 *
 * a11y :
 *   - `role="list"` + `role="listitem"` implicite via la semantique
 *     d'un `<ul>`/`<li>` (preferable a un `<div>` neutre).
 */
interface TourneeGridProps {
  readonly cards: readonly TourneeEquipementCard[];
  readonly currentCreneau: Creneau | null;
}

const EMPTY_MESSAGE = "Aucun equipement actif pour cette boutique aujourd'hui";

export function TourneeGrid({ cards, currentCreneau }: TourneeGridProps) {
  if (cards.length === 0) {
    return (
      <section
        className="rounded-lg border border-mg-noir/10 bg-white px-6 py-16 text-center"
        data-testid="tournee-grid-empty"
        aria-live="polite"
      >
        <p className="text-sm font-light italic text-mg-noir/60">
          {EMPTY_MESSAGE}
        </p>
      </section>
    );
  }

  return (
    <ul
      className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
      data-testid="tournee-grid"
      aria-label="Equipements de la tournee"
    >
      {cards.map((card) => (
        <li key={card.equipementId}>
          <TourneeCard card={card} currentCreneau={currentCreneau} />
        </li>
      ))}
    </ul>
  );
}
