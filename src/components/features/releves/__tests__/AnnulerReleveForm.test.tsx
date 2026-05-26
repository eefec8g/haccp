import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReleveListItem } from '@/types/releve';

/**
 * Tests AnnulerReleveForm (US-REL-004).
 *
 * Strategie : `renderToStaticMarkup` rend la sortie initiale du Client
 * Component (useActionState retourne l'etat initial cote serveur). On
 * verifie :
 *   - le rendu initial : hidden releveId, motif vide, replacement masque,
 *   - les attributs a11y critiques (aria-busy, aria-live, role=alert),
 *   - les data-testid pour les futurs tests E2E,
 *   - la presence du compteur de motif.
 *
 * On mock `next/link` pour eviter la complexite du Router de Next.js
 * dans un render SSR pur, et on mock la Server Action pour decoupler
 * le test client du test de l'action (cf. releve-correction.test.ts).
 */

vi.mock('@/app/actions/releve-correction', () => ({
  annulerReleveAction: vi.fn(),
}));

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

import { AnnulerReleveForm } from '../AnnulerReleveForm';

function buildReleve(overrides: Partial<ReleveListItem> = {}): ReleveListItem {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    date: new Date('2026-05-26T00:00:00.000Z'),
    creneau: 'MATIN',
    temperature: -20,
    alerteHorsSeuils: false,
    commentaire: null,
    equipementId: 'eq-1',
    equipementNom: 'Congelateur A',
    equipementType: 'CONGELATEUR',
    boutiqueId: 'b-1',
    boutiqueNom: 'MG Paris 11',
    salarieEmail: 'sal@maison-givre.fr',
    salarieName: 'Lea',
    annule: false,
    annuleParReleveId: null,
    motifAnnulation: null,
    createdAt: new Date('2026-05-26T08:30:00.000Z'),
    ...overrides,
  };
}

describe('[Releves] AnnulerReleveForm', () => {
  it('should render the form with hidden releveId and summary fields', () => {
    const html = renderToStaticMarkup(
      <AnnulerReleveForm
        releve={buildReleve()}
        cancelHref="/releves/historique"
      />
    );
    expect(html).toContain('data-testid="annuler-releve-form"');
    expect(html).toContain(
      'name="releveId" value="11111111-1111-4111-8111-111111111111"'
    );
    expect(html).toContain('data-testid="annuler-releve-equipement"');
    expect(html).toContain('Congelateur A');
    expect(html).toContain('data-testid="annuler-releve-date"');
    expect(html).toContain('26/05/2026');
    expect(html).toContain('Matin');
    expect(html).toContain('data-testid="annuler-releve-temperature"');
    expect(html).toContain('-20.0 degC');
  });

  it('should render motif counter at 0/500 initially', () => {
    const html = renderToStaticMarkup(
      <AnnulerReleveForm
        releve={buildReleve()}
        cancelHref="/releves/historique"
      />
    );
    expect(html).toContain('data-testid="annuler-releve-motif-counter"');
    expect(html).toContain('0 / 500 caracteres');
    expect(html).toContain('minimum 10');
  });

  it('should hide the replacement block by default', () => {
    const html = renderToStaticMarkup(
      <AnnulerReleveForm
        releve={buildReleve()}
        cancelHref="/releves/historique"
      />
    );
    expect(html).toContain('data-testid="annuler-releve-toggle-replacement"');
    expect(html).not.toContain(
      'data-testid="annuler-releve-replacement-block"'
    );
    expect(html).not.toContain(
      'data-testid="annuler-releve-replacement-temperature"'
    );
  });

  it('should render the submit button with aria-busy=false initially', () => {
    const html = renderToStaticMarkup(
      <AnnulerReleveForm
        releve={buildReleve()}
        cancelHref="/releves/historique"
      />
    );
    expect(html).toContain('data-testid="annuler-releve-submit"');
    expect(html).toContain('aria-busy="false"');
    expect(html).toContain('Annuler le releve');
  });

  it('should render the cancel link pointing to the provided href', () => {
    const html = renderToStaticMarkup(
      <AnnulerReleveForm
        releve={buildReleve()}
        cancelHref="/releves/historique"
      />
    );
    expect(html).toContain('data-testid="annuler-releve-cancel"');
    expect(html).toContain('href="/releves/historique"');
  });

  it('should render the global error region as sr-only when no error', () => {
    const html = renderToStaticMarkup(
      <AnnulerReleveForm
        releve={buildReleve()}
        cancelHref="/releves/historique"
      />
    );
    expect(html).toContain('data-testid="annuler-releve-error"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('class="sr-only"');
  });
});
