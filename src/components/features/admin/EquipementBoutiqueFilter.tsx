'use client';

import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useTransition } from 'react';

interface BoutiqueOption {
  readonly id: string;
  readonly nom: string;
  readonly ville?: string | null;
}

interface EquipementBoutiqueFilterProps {
  readonly boutiques: readonly BoutiqueOption[];
  readonly currentBoutiqueId: string | null;
  readonly includeInactive: boolean;
}

const LABEL_CLASSES =
  'text-[10px] font-light uppercase tracking-[0.2em] text-mg-noir/70';
const SELECT_CLASSES =
  'border border-mg-noir/15 bg-transparent px-3 py-2 text-sm font-light text-mg-noir transition-colors focus:border-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or disabled:opacity-50';

/**
 * Filtre client par boutique sur la liste equipements (US-ADM-002).
 *
 * Au changement de selection, navigue immediatement vers l'URL filtree
 * (sans clic sur un bouton "Filtrer"). useTransition donne un feedback
 * visuel pendant la navigation (disabled subtle).
 *
 * Le rendu liste reste un Server Component : ce composant fait juste un
 * `router.push(...)` qui redeclenche le rendu serveur de la page.
 */
export function EquipementBoutiqueFilter({
  boutiques,
  currentBoutiqueId,
  includeInactive,
}: EquipementBoutiqueFilterProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string): void {
    const params = new URLSearchParams();
    if (value) {
      params.set('boutiqueId', value);
    }
    if (includeInactive) {
      params.set('includeInactive', 'true');
    }
    const qs = params.toString();
    const href = (
      qs ? `/admin/equipements?${qs}` : '/admin/equipements'
    ) as Route;
    startTransition(() => {
      router.push(href);
    });
  }

  return (
    <div
      className="flex flex-wrap items-center gap-3 border-b border-mg-noir/10 py-4"
      data-testid="equipement-filter-form"
    >
      <label htmlFor="filter-boutique" className={LABEL_CLASSES}>
        Boutique
      </label>
      <select
        id="filter-boutique"
        name="boutiqueId"
        value={currentBoutiqueId ?? ''}
        onChange={(event) => handleChange(event.target.value)}
        disabled={isPending}
        className={SELECT_CLASSES}
        data-testid="equipement-filter-boutique"
        aria-busy={isPending}
      >
        <option value="">Toutes les boutiques</option>
        {boutiques.map((boutique) => (
          <option key={boutique.id} value={boutique.id}>
            {boutique.ville
              ? `${boutique.nom} - ${boutique.ville}`
              : boutique.nom}
          </option>
        ))}
      </select>
    </div>
  );
}
