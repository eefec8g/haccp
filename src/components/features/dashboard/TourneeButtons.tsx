import Link from 'next/link';
import type { Route } from 'next';
import type { Creneau } from '@prisma/client';
import { CRENEAU_LABELS, CRENEAU_ORDER } from '@/lib/constants/releve';

/**
 * Boutons de demarrage de la tournee guidee (feat/tournee-guidee).
 *
 * Server Component pur : 3 liens vers `/releves/tournee/{creneau}` pour
 * lancer la tournee Matin / Midi / Soir. Le composant remplace les
 * boutons "Saisir" inline du tableau dashboard, qui sont supprimes.
 *
 * Charte Maison Givre :
 *   - Boutons imposants (h-16) pour usage tactile en boutique avec gants.
 *   - Fond mg-noir, hover mg-or, ring or au focus.
 *
 * data-testid : `tournee-button-{creneau-lowercase}` (matin/midi/soir).
 */

interface TourneeButtonsProps {
  /** `data-testid` du wrapper. */
  readonly testId?: string;
  /** Optionnel : ajoute `?boutiqueId=...` aux liens (multi-boutiques). */
  readonly boutiqueId?: string | null;
}

const WRAPPER_CLASSES = 'grid grid-cols-1 gap-3 sm:grid-cols-3';
const BUTTON_CLASSES =
  'inline-flex h-16 w-full items-center justify-center gap-2 bg-mg-noir px-6 text-[12px] font-medium uppercase tracking-[0.3em] text-mg-ivoire transition-colors hover:bg-mg-or hover:text-mg-noir focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';
const EYEBROW_CLASSES =
  'text-[10px] font-medium uppercase tracking-[0.3em] text-mg-or';

function buildHref(creneau: Creneau, boutiqueId: string | null): Route {
  const base = `/releves/tournee/${creneau}`;
  return (boutiqueId ? `${base}?boutiqueId=${boutiqueId}` : base) as Route;
}

function testIdFor(creneau: Creneau): string {
  return `tournee-button-${creneau.toLowerCase()}`;
}

export function TourneeButtons({ testId, boutiqueId }: TourneeButtonsProps) {
  const dataTestId = testId ?? 'tournee-buttons';
  const scopedBoutiqueId = boutiqueId ?? null;
  return (
    <section
      className="flex flex-col gap-3"
      data-testid={dataTestId}
      aria-label="Demarrer une tournee"
    >
      <p className={EYEBROW_CLASSES}>Demarrer une tournee</p>
      <div className={WRAPPER_CLASSES}>
        {CRENEAU_ORDER.map((creneau) => (
          <Link
            key={creneau}
            href={buildHref(creneau, scopedBoutiqueId)}
            className={BUTTON_CLASSES}
            data-testid={testIdFor(creneau)}
            aria-label={`Demarrer la tournee ${CRENEAU_LABELS[creneau]}`}
          >
            Tournee {CRENEAU_LABELS[creneau]}
          </Link>
        ))}
      </div>
    </section>
  );
}
