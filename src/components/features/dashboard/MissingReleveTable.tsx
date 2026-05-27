import type { MissingReleveEntry } from '@/types/dashboard';
import { CreneauBadge } from '@/components/features/releves/CreneauBadge';

/**
 * MissingReleveTable - Tableau des saisies manquantes (Server Component).
 *
 * Affiche une ligne par equipement actif ayant au moins un creneau jour
 * non saisi, avec des badges creneaux MISSING (CreneauBadge).
 *
 * Charte Maison Givre : pas de couleurs vives, table sobre ivoire,
 * ligne header en mg-or, separateurs `mg-noir/10`.
 *
 * Empty state quand `entries` est vide : encart sobre "Toutes les
 * saisies sont a jour" (l'UI confirme qu'il n'y a rien a faire, ne
 * laisse pas une zone vide).
 *
 * a11y : `<table>` semantique, scope="col" sur les en-tetes.
 */

interface MissingReleveTableProps {
  readonly entries: readonly MissingReleveEntry[];
  /** `data-testid` du wrapper (defaut : missing-releve-table). */
  readonly testId?: string;
}

const WRAPPER_CLASSES =
  'overflow-hidden rounded-lg border border-mg-noir/10 bg-white';
const TABLE_CLASSES = 'min-w-full text-sm text-mg-noir';
const HEAD_CLASSES =
  'bg-mg-ivoire/60 text-[10px] font-medium uppercase tracking-[0.3em] text-mg-or';
const TH_CLASSES = 'px-6 py-3 text-left';
const ROW_CLASSES = 'border-t border-mg-noir/5 font-light';
const TD_CLASSES = 'px-6 py-4';
const EMPTY_CLASSES =
  'flex flex-col items-center gap-2 rounded-lg border border-dashed border-mg-noir/15 bg-mg-ivoire/40 px-6 py-10 text-center';
const EMPTY_TEXT_CLASSES = 'text-sm font-light text-mg-noir/70';

export function MissingReleveTable({
  entries,
  testId,
}: MissingReleveTableProps) {
  const dataTestId = testId ?? 'missing-releve-table';
  if (entries.length === 0) {
    return (
      <div
        className={EMPTY_CLASSES}
        data-testid={`${dataTestId}-empty`}
        role="status"
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-mg-or">
          Tout est OK
        </p>
        <p className={EMPTY_TEXT_CLASSES}>Toutes les saisies sont a jour.</p>
      </div>
    );
  }
  return (
    <div className={WRAPPER_CLASSES} data-testid={dataTestId}>
      <table className={TABLE_CLASSES}>
        <thead className={HEAD_CLASSES}>
          <tr>
            <th scope="col" className={TH_CLASSES}>
              Equipement
            </th>
            <th scope="col" className={TH_CLASSES}>
              Boutique
            </th>
            <th scope="col" className={TH_CLASSES}>
              Creneaux manquants
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.equipementId}
              className={ROW_CLASSES}
              data-testid={`${dataTestId}-row-${entry.equipementId}`}
            >
              <td className={TD_CLASSES}>{entry.equipementNom}</td>
              <td className={TD_CLASSES}>{entry.boutiqueNom}</td>
              <td className={TD_CLASSES}>
                <span className="flex flex-wrap gap-2">
                  {entry.creneauxManquants.map((creneau) => (
                    <CreneauBadge
                      key={creneau}
                      creneau={creneau}
                      status="MISSING"
                      data-testid={`${dataTestId}-${entry.equipementId}-${creneau}`}
                    />
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
