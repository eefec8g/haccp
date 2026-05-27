import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ReleveListingForm } from '../ReleveListingForm';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const BOUTIQUES = [
  { id: 'b1', nom: 'MG Paris 11' },
  { id: 'b2', nom: 'MG Bastille' },
];

const EQUIPEMENTS = [
  { id: 'e1', nom: 'Congelo nord', boutiqueId: 'b1' },
  { id: 'e2', nom: 'Congelo sud', boutiqueId: 'b1' },
  { id: 'e3', nom: 'Vitrine', boutiqueId: 'b2' },
];

const BASE_QUERY = {
  dateStart: '2026-04-28',
  dateEnd: '2026-05-27',
} as const;

const COMMON_PROPS = {
  boutiques: BOUTIQUES,
  equipements: EQUIPEMENTS,
  maxDate: '2026-05-27',
};

/**
 * Tests `ReleveListingForm` (Epic LISTING Phase 2). Pattern aligne sur
 * `ExportConsolideForm.test` :
 *   - renderToStaticMarkup pour assertions structurelles SSR.
 *   - `act()` + createRoot pour les interactions client (change boutique
 *     -> reset equipement).
 */

describe('[ReleveListingForm]', () => {
  it('should render all controls + default options', () => {
    const html = renderToStaticMarkup(
      <ReleveListingForm {...COMMON_PROPS} currentQuery={BASE_QUERY} />
    );

    expect(html).toContain('action="/releves/listing"');
    expect(html).toContain('method="get"');
    expect(html).toContain('data-testid="listing-form"');
    expect(html).toContain('data-testid="listing-boutique"');
    expect(html).toContain('data-testid="listing-equipement"');
    expect(html).toContain('data-testid="listing-creneau"');
    expect(html).toContain('data-testid="listing-statut"');
    expect(html).toContain('data-testid="listing-date-start"');
    expect(html).toContain('data-testid="listing-date-end"');
    expect(html).toContain('data-testid="listing-submit"');
    expect(html).toContain('data-testid="listing-reset"');
    expect(html).toContain('Toutes mes boutiques');
    expect(html).toContain('Tous les equipements');
    expect(html).toContain('MG Paris 11');
    expect(html).toContain('Congelo nord');
  });

  it('should pre-select boutique and statut from currentQuery', () => {
    const html = renderToStaticMarkup(
      <ReleveListingForm
        {...COMMON_PROPS}
        currentQuery={{
          ...BASE_QUERY,
          boutiqueId: 'b2',
          statut: 'ALERTE',
        }}
      />
    );

    expect(html).toMatch(
      /<select[^>]*data-testid="listing-boutique"[^>]*>[\s\S]*<option[^>]*value="b2"[^>]*selected/
    );
    expect(html).toMatch(
      /<select[^>]*data-testid="listing-statut"[^>]*>[\s\S]*<option[^>]*value="ALERTE"[^>]*selected/
    );
  });

  it('should filter equipements to only those of selected boutique', () => {
    const html = renderToStaticMarkup(
      <ReleveListingForm
        {...COMMON_PROPS}
        currentQuery={{ ...BASE_QUERY, boutiqueId: 'b2' }}
      />
    );

    expect(html).toContain('Vitrine');
    expect(html).not.toContain('Congelo nord');
    expect(html).not.toContain('Congelo sud');
  });

  it('should enable submit when periode is valid', () => {
    const html = renderToStaticMarkup(
      <ReleveListingForm {...COMMON_PROPS} currentQuery={BASE_QUERY} />
    );

    expect(html).toMatch(
      /<button[^>]*data-testid="listing-submit"(?![^>]*disabled)/
    );
    expect(html).not.toContain('data-testid="listing-form-client-error"');
  });

  it('should disable submit and show error when dateStart > dateEnd', () => {
    const html = renderToStaticMarkup(
      <ReleveListingForm
        {...COMMON_PROPS}
        currentQuery={{ dateStart: '2026-05-27', dateEnd: '2026-05-20' }}
      />
    );

    expect(html).toMatch(
      /<button[^>]*disabled[^>]*data-testid="listing-submit"/
    );
    expect(html).toContain('data-testid="listing-form-client-error"');
    expect(html).toContain('La date de fin doit etre superieure');
  });

  it('should disable submit when periode > 92 days', () => {
    const html = renderToStaticMarkup(
      <ReleveListingForm
        {...COMMON_PROPS}
        currentQuery={{ dateStart: '2026-01-01', dateEnd: '2026-05-15' }}
      />
    );

    expect(html).toMatch(
      /<button[^>]*disabled[^>]*data-testid="listing-submit"/
    );
    expect(html).toContain('inferieure ou egale a 92 jours');
  });

  it('should disable submit when dateEnd > maxDate (future)', () => {
    const html = renderToStaticMarkup(
      <ReleveListingForm
        {...COMMON_PROPS}
        currentQuery={{ dateStart: '2026-05-20', dateEnd: '2026-06-10' }}
      />
    );

    expect(html).toMatch(
      /<button[^>]*disabled[^>]*data-testid="listing-submit"/
    );
    expect(html).toContain('ne peut pas etre dans le futur');
  });

  it('should mark BOTH date inputs aria-invalid when dateStart > dateEnd', () => {
    const html = renderToStaticMarkup(
      <ReleveListingForm
        {...COMMON_PROPS}
        currentQuery={{ dateStart: '2026-05-27', dateEnd: '2026-05-20' }}
      />
    );

    expect(html).toMatch(
      /<input[^>]*aria-invalid="true"[^>]*data-testid="listing-date-start"/
    );
    expect(html).toMatch(
      /<input[^>]*aria-invalid="true"[^>]*data-testid="listing-date-end"/
    );
  });

  it('should mark ONLY dateEnd aria-invalid when periode too long (CC-7)', () => {
    const html = renderToStaticMarkup(
      <ReleveListingForm
        {...COMMON_PROPS}
        currentQuery={{ dateStart: '2026-01-01', dateEnd: '2026-05-15' }}
      />
    );

    expect(html).not.toMatch(
      /<input[^>]*aria-invalid="true"[^>]*data-testid="listing-date-start"/
    );
    expect(html).toMatch(
      /<input[^>]*aria-invalid="true"[^>]*data-testid="listing-date-end"/
    );
  });

  it('should render the server error message when errorMessage prop is set', () => {
    const html = renderToStaticMarkup(
      <ReleveListingForm
        {...COMMON_PROPS}
        currentQuery={BASE_QUERY}
        errorMessage="Une erreur est survenue"
      />
    );

    expect(html).toContain('data-testid="listing-form-error"');
    expect(html).toContain('Une erreur est survenue');
    expect(html).toContain('role="alert"');
  });

  it('should provide the reset link to /releves/listing', () => {
    const html = renderToStaticMarkup(
      <ReleveListingForm {...COMMON_PROPS} currentQuery={BASE_QUERY} />
    );

    // React serialise les attributs dans l'ordre de declaration JSX :
    // ici `href` peut etre place AVANT ou APRES `data-testid` selon l'ordre
    // d'expansion des props. On match donc l'anchor avec les deux
    // attributs sans presumer de l'ordre.
    expect(html).toMatch(
      /<a[^>]*data-testid="listing-reset"[^>]*href="\/releves\/listing"/
    );
  });

  it('should reset equipement filter when boutique changes to a foreign one', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ReleveListingForm
          {...COMMON_PROPS}
          currentQuery={{
            ...BASE_QUERY,
            boutiqueId: 'b1',
            equipementId: 'e1',
          }}
        />
      );
    });

    const boutiqueSelect = container.querySelector<HTMLSelectElement>(
      '[data-testid="listing-boutique"]'
    );
    expect(boutiqueSelect).not.toBeNull();

    act(() => {
      if (!boutiqueSelect) {
        return;
      }
      boutiqueSelect.value = 'b2';
      boutiqueSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const equipementSelect = container.querySelector<HTMLSelectElement>(
      '[data-testid="listing-equipement"]'
    );
    expect(equipementSelect?.value).toBe('');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
