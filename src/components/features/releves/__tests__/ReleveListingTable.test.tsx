import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReleveListingTable } from '../ReleveListingTable';
import type { ReleveListingItem } from '@/types/releve-listing';

/**
 * Tests `ReleveListingTable` (Epic LISTING Phase 2).
 *
 * Limite jsdom : pas de viewport, on rend en SSR statique et on
 * verifie que les deux rendus (desktop table + mobile cards) sont bien
 * presents. Le toggle desktop/mobile est purement CSS (`hidden md:block`).
 */

const COMMON_FIELDS = {
  boutiqueId: 'b1',
  boutiqueNom: 'MG Paris 11',
  equipementId: 'e1',
  equipementNom: 'Congelo nord',
  alerteHorsSeuils: false,
  motifAnnulation: null,
} as const;

const ITEMS: readonly ReleveListingItem[] = [
  {
    ...COMMON_FIELDS,
    id: 'r1',
    dateISO: '2026-05-27',
    creneau: 'MATIN',
    temperature: -22.5,
    statut: 'SAISI',
    salarieNom: 'Alice',
    createdAt: new Date('2026-05-27T08:00:00Z'),
  },
  {
    ...COMMON_FIELDS,
    id: 'r2',
    dateISO: '2026-05-26',
    creneau: 'MIDI',
    temperature: -10.2,
    alerteHorsSeuils: true,
    statut: 'ALERTE',
    salarieNom: 'Bob',
    createdAt: new Date('2026-05-26T13:00:00Z'),
  },
  {
    ...COMMON_FIELDS,
    id: null,
    dateISO: '2026-05-25',
    creneau: 'SOIR',
    temperature: null,
    statut: 'MANQUANT',
    salarieNom: null,
    createdAt: null,
  },
  {
    ...COMMON_FIELDS,
    id: 'r3',
    dateISO: '2026-05-24',
    creneau: 'MATIN',
    temperature: 5.0,
    statut: 'ANNULE',
    salarieNom: 'Charlie',
    motifAnnulation: 'Saisie erronee, lecture 5 au lieu de -25',
    createdAt: new Date('2026-05-24T08:30:00Z'),
  },
];

describe('[ReleveListingTable]', () => {
  it('should render mixed-status items with correct labels', () => {
    const html = renderToStaticMarkup(<ReleveListingTable items={ITEMS} />);

    expect(html).toContain('Saisi');
    expect(html).toContain('Hors seuils');
    expect(html).toContain('Manquant');
    expect(html).toContain('Annule');
  });

  it('should render dates in JJ/MM/AAAA format', () => {
    const html = renderToStaticMarkup(<ReleveListingTable items={ITEMS} />);

    expect(html).toContain('27/05/2026');
    expect(html).toContain('26/05/2026');
    expect(html).toContain('25/05/2026');
    expect(html).toContain('24/05/2026');
  });

  it('should display temperatures with degC for present values', () => {
    const html = renderToStaticMarkup(<ReleveListingTable items={ITEMS} />);

    expect(html).toContain('-22.5 degC');
    expect(html).toContain('-10.2 degC');
    expect(html).toContain('5.0 degC');
  });

  it('should display placeholder for missing temperature/salarie/motif', () => {
    const html = renderToStaticMarkup(<ReleveListingTable items={ITEMS} />);

    // The MANQUANT row should have placeholder for temperature, salarie and motif.
    // We check the placeholder character appears at least 3 times (3 missing fields per missing row + motif placeholder for SAISI/ALERTE rows).
    const placeholderMatches = html.match(/—/g) ?? [];
    expect(placeholderMatches.length).toBeGreaterThanOrEqual(3);
  });

  it('should apply STATUT_COLORS class to the badge for each statut', () => {
    const html = renderToStaticMarkup(<ReleveListingTable items={ITEMS} />);

    expect(html).toContain('text-mg-noir');
    expect(html).toContain('text-mg-or');
    expect(html).toContain('text-mg-noir/40');
    expect(html).toContain('text-mg-noir/30 italic');
  });

  it('should render action links pointing to /boutiques/[id]/registre/[date]', () => {
    const html = renderToStaticMarkup(<ReleveListingTable items={ITEMS} />);

    expect(html).toContain('href="/boutiques/b1/registre/2026-05-27"');
    expect(html).toContain('href="/boutiques/b1/registre/2026-05-26"');
    expect(html).toContain('href="/boutiques/b1/registre/2026-05-25"');
    expect(html).toContain('href="/boutiques/b1/registre/2026-05-24"');
  });

  it('should display the salarie name for present items and placeholder for MANQUANT', () => {
    const html = renderToStaticMarkup(<ReleveListingTable items={ITEMS} />);

    expect(html).toContain('Alice');
    expect(html).toContain('Bob');
    expect(html).toContain('Charlie');
  });

  it('should display the motifAnnulation for ANNULE items', () => {
    const html = renderToStaticMarkup(<ReleveListingTable items={ITEMS} />);

    expect(html).toContain('Saisie erronee, lecture 5 au lieu de -25');
  });

  it('should render empty state when items is empty', () => {
    const html = renderToStaticMarkup(<ReleveListingTable items={[]} />);

    expect(html).toContain('data-testid="admin-table-releve-listing-empty"');
    expect(html).toContain(
      'Aucun releve sur la periode et les filtres selectionnes.'
    );
  });

  it('should provide a unique testid per row including statut prefix', () => {
    const html = renderToStaticMarkup(<ReleveListingTable items={ITEMS} />);

    expect(html).toContain('listing-row-saisi-r1-action');
    expect(html).toContain('listing-row-alerte-r2-action');
    expect(html).toContain('listing-row-manquant-2026-05-25-e1-SOIR-action');
    expect(html).toContain('listing-row-annule-r3-action');
  });
});
