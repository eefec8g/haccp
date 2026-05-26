import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AlerteListItem } from '@/lib/services/alerte.service';
import { AlerteList } from '../AlerteList';

/**
 * Tests AlerteList (US-ALE-001) :
 *   - empty state quand items vide
 *   - rendu d'une carte par alerte avec data-testid `alerte-item-<id>`
 *   - pagination affichee si totalPages > 1
 *   - pagination absente si totalPages === 1
 *
 * Server Component pur : on rend en static markup et on assert sur le
 * HTML genere (data-testid + classes). Pattern aligne sur
 * ReleveHistoryList.
 */

function buildAlerte(overrides: Partial<AlerteListItem> = {}): AlerteListItem {
  return {
    id: overrides.id ?? 'a-1',
    status: 'OUVERTE',
    createdAt: new Date('2026-05-26T08:00:00.000Z'),
    releve: {
      id: 'r-1',
      dateISO: '2026-05-26',
      creneau: 'MATIN',
      temperature: -10,
      commentaire: 'porte ouverte',
      equipementNom: 'Congelateur A',
      equipementType: 'CONGELATEUR',
      boutiqueId: 'b-1',
      boutiqueNom: 'MG Paris 11',
      seuilMin: -25,
      seuilMax: -18,
    },
    ...overrides,
  };
}

const PAGINATION_SINGLE_PAGE = {
  page: 1,
  pageSize: 20,
  total: 1,
  totalPages: 1,
} as const;

const PAGINATION_MULTI_PAGE = {
  page: 2,
  pageSize: 20,
  total: 50,
  totalPages: 3,
} as const;

describe('[Alertes] AlerteList', () => {
  it('should render the empty state with "tout est en ordre" when items is empty', () => {
    const html = renderToStaticMarkup(
      <AlerteList items={[]} pagination={PAGINATION_SINGLE_PAGE} />
    );
    expect(html).toContain('data-testid="alerte-list-empty"');
    expect(html).toContain('Aucune alerte ouverte. Tout est en ordre.');
    expect(html).not.toContain('data-testid="alerte-list"');
  });

  it('should render one card per item with alerte-item-<id> testid', () => {
    const items = [
      buildAlerte({ id: 'a-1' }),
      buildAlerte({ id: 'a-2' }),
      buildAlerte({ id: 'a-3' }),
    ];
    const html = renderToStaticMarkup(
      <AlerteList items={items} pagination={PAGINATION_SINGLE_PAGE} />
    );
    expect(html).toContain('data-testid="alerte-list"');
    expect(html).toContain('data-testid="alerte-item-a-1"');
    expect(html).toContain('data-testid="alerte-item-a-2"');
    expect(html).toContain('data-testid="alerte-item-a-3"');
  });

  it('should render pagination links when totalPages > 1', () => {
    const items = [buildAlerte()];
    const html = renderToStaticMarkup(
      <AlerteList items={items} pagination={PAGINATION_MULTI_PAGE} />
    );
    expect(html).toContain('data-testid="admin-pagination"');
    expect(html).toContain('/alertes?page=1');
    expect(html).toContain('/alertes?page=3');
  });

  it('should NOT render pagination when totalPages === 1', () => {
    const items = [buildAlerte()];
    const html = renderToStaticMarkup(
      <AlerteList items={items} pagination={PAGINATION_SINGLE_PAGE} />
    );
    expect(html).not.toContain('data-testid="admin-pagination"');
  });

  it('should display equipement, boutique, temperature, seuils and link to detail page', () => {
    const items = [
      buildAlerte({
        id: 'a-42',
        releve: {
          id: 'r-42',
          dateISO: '2026-05-26',
          creneau: 'MIDI',
          temperature: -10.5,
          commentaire: 'porte ouverte 5 min',
          equipementNom: 'Congelateur principal',
          equipementType: 'CONGELATEUR',
          boutiqueId: 'b-9',
          boutiqueNom: 'MG Lyon',
          seuilMin: -25,
          seuilMax: -18,
        },
      }),
    ];
    const html = renderToStaticMarkup(
      <AlerteList items={items} pagination={PAGINATION_SINGLE_PAGE} />
    );
    expect(html).toContain('Congelateur principal');
    expect(html).toContain('MG Lyon');
    expect(html).toContain('-10.5 degC');
    expect(html).toContain('-25.0 / -18.0 degC');
    expect(html).toContain('26/05/2026');
    expect(html).toContain('href="/alertes/a-42"');
    expect(html).toContain('porte ouverte 5 min');
  });

  it('should display "Ouverte" badge and equipement type label', () => {
    const html = renderToStaticMarkup(
      <AlerteList items={[buildAlerte()]} pagination={PAGINATION_SINGLE_PAGE} />
    );
    expect(html).toContain('Ouverte');
    expect(html).toContain('Congelateur');
  });
});
