import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReleveListItem } from '@/types/releve';
import { ReleveHistoryList } from '../ReleveHistoryList';

/**
 * Tests ReleveHistoryList (US-REL-003) :
 *   - empty state quand items vide
 *   - rendu d'une ligne par item avec data-testid `releve-row-<id>`
 *   - variante "Annule" appliquee aux releves annules (line-through)
 *   - pagination affichee si totalPages > 1
 *   - pagination absente si totalPages === 1
 *
 * Server Component pur : on rend en static markup et on assert sur le
 * HTML genere (data-testid + classes).
 */

function buildItem(overrides: Partial<ReleveListItem> = {}): ReleveListItem {
  return {
    id: 'r-1',
    date: new Date('2026-05-26T00:00:00.000Z'),
    creneau: 'MATIN',
    temperature: -20.5,
    alerteHorsSeuils: false,
    commentaire: null,
    equipementId: 'eq-1',
    equipementNom: 'Congelateur A',
    equipementType: 'CONGELATEUR',
    boutiqueId: 'b-1',
    boutiqueNom: 'MG Paris 11',
    salarieEmail: null,
    salarieName: null,
    annule: false,
    annuleParReleveId: null,
    motifAnnulation: null,
    createdAt: new Date('2026-05-26T08:30:00.000Z'),
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

describe('[Releves] ReleveHistoryList', () => {
  it('should render empty state when items is empty', () => {
    const html = renderToStaticMarkup(
      <ReleveHistoryList items={[]} pagination={PAGINATION_SINGLE_PAGE} />
    );
    expect(html).toContain('data-testid="releve-history-empty"');
    expect(html).toContain('Aucun releve sur les 7 derniers jours.');
    expect(html).not.toContain('data-testid="releve-history-list"');
  });

  it('should render one row per item with releve-row-<id> testid', () => {
    const items = [
      buildItem({ id: 'r-1' }),
      buildItem({ id: 'r-2' }),
      buildItem({ id: 'r-3' }),
    ];
    const html = renderToStaticMarkup(
      <ReleveHistoryList items={items} pagination={PAGINATION_SINGLE_PAGE} />
    );
    expect(html).toContain('data-testid="releve-history-list"');
    expect(html).toContain('data-testid="releve-row-r-1"');
    expect(html).toContain('data-testid="releve-row-r-2"');
    expect(html).toContain('data-testid="releve-row-r-3"');
  });

  it('should apply line-through style and ANNULE label on cancelled releves', () => {
    const items = [
      buildItem({
        id: 'r-cancel',
        annule: true,
        annuleParReleveId: 'r-other',
        motifAnnulation: 'Erreur de saisie',
      }),
    ];
    const html = renderToStaticMarkup(
      <ReleveHistoryList items={items} pagination={PAGINATION_SINGLE_PAGE} />
    );
    // Style barre via la classe "line-through" appliquee a la ligne.
    expect(html).toContain('line-through');
    // Variante ANNULE du status indicator.
    expect(html).toContain('data-testid="releve-row-r-cancel-status"');
    expect(html).toContain('Annule');
    expect(html).toContain('aria-disabled="true"');
  });

  it('should render pagination links when totalPages > 1', () => {
    const items = [buildItem()];
    const html = renderToStaticMarkup(
      <ReleveHistoryList items={items} pagination={PAGINATION_MULTI_PAGE} />
    );
    expect(html).toContain('data-testid="admin-pagination"');
    expect(html).toContain('data-testid="admin-pagination-prev"');
    expect(html).toContain('data-testid="admin-pagination-next"');
    expect(html).toContain('/releves/historique?page=1');
    expect(html).toContain('/releves/historique?page=3');
  });

  it('should NOT render pagination when totalPages === 1', () => {
    const items = [buildItem()];
    const html = renderToStaticMarkup(
      <ReleveHistoryList items={items} pagination={PAGINATION_SINGLE_PAGE} />
    );
    expect(html).not.toContain('data-testid="admin-pagination"');
  });

  it('should display the formatted temperature and date', () => {
    const items = [
      buildItem({
        temperature: -18.7,
        date: new Date('2026-05-26T00:00:00.000Z'),
      }),
    ];
    const html = renderToStaticMarkup(
      <ReleveHistoryList items={items} pagination={PAGINATION_SINGLE_PAGE} />
    );
    expect(html).toContain('-18.7 degC');
    expect(html).toContain('26/05/2026');
  });
});
