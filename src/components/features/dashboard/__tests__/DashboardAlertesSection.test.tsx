import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AlerteListItem as AlerteListItemData } from '@/lib/services/alerte.service';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
    'data-testid': dataTestid,
  }: {
    readonly href: string;
    readonly children: React.ReactNode;
    readonly className?: string;
    readonly 'data-testid'?: string;
  }) => (
    <a href={href} className={className} data-testid={dataTestid}>
      {children}
    </a>
  ),
}));

import { DashboardAlertesSection } from '../DashboardAlertesSection';

/**
 * Tests DashboardAlertesSection (US-DAS-001/002).
 *
 * Couvre :
 *  - empty state accessible (role=status) avec message par defaut,
 *  - rendu d'une liste `<ul>` semantique avec un `<li>` par alerte,
 *  - override du titre / empty message via props,
 *  - propagation du testId aux sous-elements (list + empty).
 */

function buildAlerte(
  overrides: Partial<AlerteListItemData> = {}
): AlerteListItemData {
  return {
    id: overrides.id ?? 'alerte-1',
    status: 'OUVERTE',
    createdAt: overrides.createdAt ?? new Date('2026-05-26T10:00:00.000Z'),
    releve: {
      id: 'releve-1',
      dateISO: '2026-05-26',
      creneau: 'MATIN',
      temperature: -10,
      commentaire: null,
      equipementNom: 'Congelateur A',
      equipementType: 'CONGELATEUR',
      boutiqueId: 'b-1',
      boutiqueNom: 'MG Paris 11',
      seuilMin: -25,
      seuilMax: -18,
      ...overrides.releve,
    },
  };
}

describe('[Dashboard] DashboardAlertesSection', () => {
  it('should render the empty state when alertes is empty', () => {
    const html = renderToStaticMarkup(<DashboardAlertesSection alertes={[]} />);
    expect(html).toContain('data-testid="dashboard-alertes-section-empty"');
    expect(html).toContain('Aucune alerte ouverte.');
    expect(html).toContain('role="status"');
    expect(html).not.toContain('<ul');
  });

  it('should render an <ul> with one <li> per alerte', () => {
    const alertes = [
      buildAlerte({ id: 'a1' }),
      buildAlerte({ id: 'a2' }),
      buildAlerte({ id: 'a3' }),
    ];
    const html = renderToStaticMarkup(
      <DashboardAlertesSection alertes={alertes} />
    );
    expect(html).toContain('<ul');
    expect(html).toContain('data-testid="dashboard-alertes-section-list"');
    expect(html).toContain('data-testid="alerte-item-a1"');
    expect(html).toContain('data-testid="alerte-item-a2"');
    expect(html).toContain('data-testid="alerte-item-a3"');
  });

  it('should override title and emptyMessage via props', () => {
    const html = renderToStaticMarkup(
      <DashboardAlertesSection
        alertes={[]}
        title="Alertes ouvertes (admin)"
        emptyMessage="Tout est conforme."
      />
    );
    expect(html).toContain('Alertes ouvertes (admin)');
    expect(html).toContain('aria-label="Alertes ouvertes (admin)"');
    expect(html).toContain('Tout est conforme.');
  });

  it('should propagate the testId prefix to the list and empty subnodes', () => {
    const emptyHtml = renderToStaticMarkup(
      <DashboardAlertesSection alertes={[]} testId="custom-alertes" />
    );
    expect(emptyHtml).toContain('data-testid="custom-alertes"');
    expect(emptyHtml).toContain('data-testid="custom-alertes-empty"');

    const listHtml = renderToStaticMarkup(
      <DashboardAlertesSection
        alertes={[buildAlerte({ id: 'a1' })]}
        testId="custom-alertes"
      />
    );
    expect(listHtml).toContain('data-testid="custom-alertes"');
    expect(listHtml).toContain('data-testid="custom-alertes-list"');
  });
});
