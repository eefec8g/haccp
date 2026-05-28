import type { AlerteListItem as AlerteListItemData } from '@/lib/services/alerte.service';
import { AlerteListItem } from '@/components/features/alertes/AlerteListItem';
import { MG_EYEBROW_CLASSES } from '@/lib/constants/styles';

/**
 * DashboardAlertesSection - Section "Alertes recentes" partagee entre
 * les deux dashboards (US-DAS-001 responsable, US-DAS-002 admin).
 *
 * Server Component pur, sans state ni hooks. Centralise la structure
 * DOM auparavant divergente entre les deux pages (sources de bugs DRY
 * et a11y).
 *
 * Structure semantique :
 *   - <section aria-label="..."> avec eyebrow titre,
 *   - liste `<ul>` de `<li><AlerteListItem/></li>` si alertes presentes,
 *   - empty state `<p role="status">` accessible si liste vide.
 *
 * Reutilise `MG_EYEBROW_CLASSES` (Clean Code #4 DRY).
 */

const DEFAULT_TITLE = 'Alertes recentes';
const DEFAULT_EMPTY = 'Aucune alerte ouverte.';
const DEFAULT_TEST_ID = 'dashboard-alertes-section';

const SECTION_CLASSES = 'flex flex-col gap-4';
const HEADER_CLASSES = 'flex flex-col gap-2';
const DIVIDER_CLASSES = 'inline-block h-px w-12 bg-mg-or';
const LIST_CLASSES = 'flex flex-col gap-3';
const EMPTY_CLASSES =
  'rounded-lg border border-dashed border-mg-noir/15 bg-white px-6 py-10 text-center text-sm font-light italic text-mg-noir/60';

interface DashboardAlertesSectionProps {
  readonly alertes: readonly AlerteListItemData[];
  readonly title?: string;
  readonly emptyMessage?: string;
  readonly testId?: string;
  /**
   * Affiche le lien "Resoudre" sur chaque carte. Defaut `true` : cette
   * section n'est rendue que par les dashboards RESPONSABLE/ADMIN (le
   * dashboard SALARIE affiche la tournee du jour, pas les alertes).
   */
  readonly canManage?: boolean;
}

export function DashboardAlertesSection({
  alertes,
  title = DEFAULT_TITLE,
  emptyMessage = DEFAULT_EMPTY,
  testId = DEFAULT_TEST_ID,
  canManage = true,
}: DashboardAlertesSectionProps) {
  return (
    <section
      className={SECTION_CLASSES}
      data-testid={testId}
      aria-label={title}
    >
      <header className={HEADER_CLASSES}>
        <p className={MG_EYEBROW_CLASSES}>{title}</p>
        <span aria-hidden="true" className={DIVIDER_CLASSES} />
      </header>
      {alertes.length === 0 ? (
        <p
          className={EMPTY_CLASSES}
          role="status"
          data-testid={`${testId}-empty`}
        >
          {emptyMessage}
        </p>
      ) : (
        <ul className={LIST_CLASSES} data-testid={`${testId}-list`}>
          {alertes.map((alerte) => (
            <li key={alerte.id}>
              <AlerteListItem alerte={alerte} canManage={canManage} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
