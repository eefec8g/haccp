import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExportConsolideForm } from '../ExportConsolideForm';

const BOUTIQUES = [
  { id: 'b1', nom: 'MG Paris 11', ville: 'Paris' },
  { id: 'b2', nom: 'MG Bastille', ville: null },
];

const COMMON_PROPS = {
  actionUrl: '/api/exports/registre-consolide',
  csvActionUrl: '/api/exports/csv',
  boutiques: BOUTIQUES,
  maxDate: '2026-05-27',
  maxPeriodeDays: 31,
};

/**
 * Tests du composant `ExportConsolideForm`.
 *
 * Limite jsdom : sans `@testing-library/react`, on utilise
 * `renderToStaticMarkup` (cf. `ExportForm.test.tsx`) qui rend le SSR
 * initial. La validation client est calculee a partir des props par
 * defaut (`defaultDateStart` / `defaultDateEnd`) ; on teste donc les
 * cas en variant ces props, ce qui couvre la fonction de validation
 * indirectement avec un cout cognitif minimal.
 *
 * Depuis fix/csv-in-consolide, le formulaire expose DEUX boutons
 * submit (PDF + CSV) qui partagent la meme validation et soumettent
 * a deux Route Handlers via `formAction`.
 */

describe('[ExportConsolideForm]', () => {
  it('should render with all-boutiques option and one option per boutique', () => {
    const html = renderToStaticMarkup(
      <ExportConsolideForm
        {...COMMON_PROPS}
        defaultDateStart="2026-04-28"
        defaultDateEnd="2026-05-27"
      />
    );
    expect(html).toContain('action="/api/exports/registre-consolide"');
    expect(html).toContain('method="get"');
    expect(html).toContain('Toutes mes boutiques');
    expect(html).toContain('MG Paris 11 (Paris)');
    expect(html).toContain('MG Bastille');
    expect(html).toContain('data-testid="consolide-form"');
    expect(html).toContain('data-testid="consolide-boutique"');
    expect(html).toContain('data-testid="consolide-date-start"');
    expect(html).toContain('data-testid="consolide-date-end"');
    expect(html).toContain('data-testid="consolide-submit-pdf"');
    expect(html).toContain('data-testid="consolide-submit-csv"');
    expect(html).toContain('data-testid="consolide-cancel"');
  });

  it('should expose a CSV submit button with formAction targeting the CSV route handler', () => {
    const html = renderToStaticMarkup(
      <ExportConsolideForm
        {...COMMON_PROPS}
        defaultDateStart="2026-05-20"
        defaultDateEnd="2026-05-27"
      />
    );

    // Le bouton CSV doit overrider l'action du form via formAction.
    // L'ordre des attributs est non garanti : on cherche le bouton CSV
    // par son testid puis on verifie que le meme <button> porte le
    // formAction attendu (les regex SSR sont sensibles a l'ordre).
    const csvButtonMatch = html.match(
      /<button[^>]*data-testid="consolide-submit-csv"[^>]*>/
    );
    expect(csvButtonMatch).not.toBeNull();
    expect(csvButtonMatch?.[0]).toContain('formAction="/api/exports/csv"');

    // Le bouton PDF ne porte PAS de formAction (il herite de form action).
    const pdfButtonMatch = html.match(
      /<button[^>]*data-testid="consolide-submit-pdf"[^>]*>/
    );
    expect(pdfButtonMatch).not.toBeNull();
    expect(pdfButtonMatch?.[0]).not.toContain('formAction');
  });

  it('should expose hidden dateFrom/dateTo inputs synchronized with dateStart/dateEnd', () => {
    // La route CSV attend `dateFrom`/`dateTo` ; on alimente ces noms
    // via des inputs hidden synchronizes sur le meme state que les
    // inputs visibles `dateStart`/`dateEnd`.
    const html = renderToStaticMarkup(
      <ExportConsolideForm
        {...COMMON_PROPS}
        defaultDateStart="2026-05-20"
        defaultDateEnd="2026-05-27"
      />
    );

    expect(html).toMatch(
      /<input[^>]*type="hidden"[^>]*name="dateFrom"[^>]*value="2026-05-20"/
    );
    expect(html).toMatch(
      /<input[^>]*type="hidden"[^>]*name="dateTo"[^>]*value="2026-05-27"/
    );
  });

  it('should expose aria-label on both submit buttons for screen readers', () => {
    const html = renderToStaticMarkup(
      <ExportConsolideForm
        {...COMMON_PROPS}
        defaultDateStart="2026-05-20"
        defaultDateEnd="2026-05-27"
      />
    );

    expect(html).toMatch(
      /<button[^>]*aria-label="Telecharger le registre PDF"[^>]*data-testid="consolide-submit-pdf"/
    );
    expect(html).toMatch(
      /<button[^>]*aria-label="Telecharger le registre CSV"[^>]*data-testid="consolide-submit-csv"/
    );
  });

  it('should enable BOTH submit buttons when periode is valid', () => {
    const html = renderToStaticMarkup(
      <ExportConsolideForm
        {...COMMON_PROPS}
        defaultDateStart="2026-05-20"
        defaultDateEnd="2026-05-27"
      />
    );
    expect(html).toMatch(
      /<button[^>]*data-testid="consolide-submit-pdf"(?![^>]*disabled)/
    );
    expect(html).toMatch(
      /<button[^>]*data-testid="consolide-submit-csv"(?![^>]*disabled)/
    );
    expect(html).not.toContain('data-testid="consolide-form-client-error"');
  });

  it('should disable BOTH submit buttons and show error when dateStart > dateEnd', () => {
    const html = renderToStaticMarkup(
      <ExportConsolideForm
        {...COMMON_PROPS}
        defaultDateStart="2026-05-27"
        defaultDateEnd="2026-05-20"
      />
    );
    expect(html).toMatch(
      /<button[^>]*disabled[^>]*data-testid="consolide-submit-pdf"/
    );
    expect(html).toMatch(
      /<button[^>]*disabled[^>]*data-testid="consolide-submit-csv"/
    );
    expect(html).toContain('data-testid="consolide-form-client-error"');
    expect(html).toContain('La date de fin doit etre superieure');
  });

  it('should disable BOTH submit buttons and show error when periode > maxPeriodeDays', () => {
    const html = renderToStaticMarkup(
      <ExportConsolideForm
        {...COMMON_PROPS}
        defaultDateStart="2026-03-01"
        defaultDateEnd="2026-05-15"
      />
    );
    expect(html).toMatch(
      /<button[^>]*disabled[^>]*data-testid="consolide-submit-pdf"/
    );
    expect(html).toMatch(
      /<button[^>]*disabled[^>]*data-testid="consolide-submit-csv"/
    );
    expect(html).toContain('inferieure ou egale a 31 jours');
  });

  it('should disable BOTH submit buttons and show error when dateEnd > maxDate (future)', () => {
    const html = renderToStaticMarkup(
      <ExportConsolideForm
        {...COMMON_PROPS}
        defaultDateStart="2026-05-20"
        defaultDateEnd="2026-06-10"
      />
    );
    expect(html).toMatch(
      /<button[^>]*disabled[^>]*data-testid="consolide-submit-pdf"/
    );
    expect(html).toMatch(
      /<button[^>]*disabled[^>]*data-testid="consolide-submit-csv"/
    );
    expect(html).toContain('ne peut pas etre dans le futur');
  });

  it('should render the server error message when errorMessage prop is set', () => {
    const html = renderToStaticMarkup(
      <ExportConsolideForm
        {...COMMON_PROPS}
        defaultDateStart="2026-05-20"
        defaultDateEnd="2026-05-27"
        errorMessage="Trop d'exports recents. Patientez 5 minutes."
      />
    );
    expect(html).toContain('data-testid="consolide-form-error"');
    expect(html).toContain('Patientez 5 minutes');
    expect(html).toContain('role="alert"');
  });

  it('should mark BOTH inputs aria-invalid when dateStart > dateEnd (both participate)', () => {
    const html = renderToStaticMarkup(
      <ExportConsolideForm
        {...COMMON_PROPS}
        defaultDateStart="2026-05-27"
        defaultDateEnd="2026-05-20"
      />
    );
    expect(html).toMatch(
      /<input[^>]*aria-required="true"[^>]*aria-invalid="true"[^>]*data-testid="consolide-date-start"/
    );
    expect(html).toMatch(
      /<input[^>]*aria-required="true"[^>]*aria-invalid="true"[^>]*data-testid="consolide-date-end"/
    );
  });

  it('should mark ONLY dateEnd aria-invalid when dateEnd > maxDate (CC-7)', () => {
    const html = renderToStaticMarkup(
      <ExportConsolideForm
        {...COMMON_PROPS}
        defaultDateStart="2026-05-20"
        defaultDateEnd="2026-06-10"
      />
    );
    // dateStart NOT marked invalid (start was OK, only end is in the future)
    expect(html).not.toMatch(
      /<input[^>]*aria-invalid="true"[^>]*data-testid="consolide-date-start"/
    );
    // dateEnd marked invalid
    expect(html).toMatch(
      /<input[^>]*aria-invalid="true"[^>]*data-testid="consolide-date-end"/
    );
  });

  it('should mark ONLY dateEnd aria-invalid when periode > maxPeriodeDays (CC-7)', () => {
    const html = renderToStaticMarkup(
      <ExportConsolideForm
        {...COMMON_PROPS}
        defaultDateStart="2026-03-01"
        defaultDateEnd="2026-05-15"
      />
    );
    expect(html).not.toMatch(
      /<input[^>]*aria-invalid="true"[^>]*data-testid="consolide-date-start"/
    );
    expect(html).toMatch(
      /<input[^>]*aria-invalid="true"[^>]*data-testid="consolide-date-end"/
    );
  });

  it('should link form to error message via aria-describedby when error is set', () => {
    const html = renderToStaticMarkup(
      <ExportConsolideForm
        {...COMMON_PROPS}
        defaultDateStart="2026-05-20"
        defaultDateEnd="2026-05-27"
        errorMessage="Erreur server"
      />
    );
    expect(html).toMatch(
      /<form[^>]*aria-describedby="[^"]*consolide-form-server-error[^"]*"/
    );
  });
});
