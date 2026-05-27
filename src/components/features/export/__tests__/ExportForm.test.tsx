import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExportForm } from '../ExportForm';

const BOUTIQUES = [
  { id: 'b1', nom: 'MG Paris 11' },
  { id: 'b2', nom: 'MG Bastille' },
];

const EQUIPEMENTS = [
  { id: 'e1', nom: 'CGL-01', boutiqueId: 'b1' },
  { id: 'e2', nom: 'CGL-02', boutiqueId: 'b2' },
];

const DEFAULT_DATE = '2026-05-27';

describe('[ExportForm]', () => {
  it('should render CSV mode with date range and optional boutique', () => {
    const html = renderToStaticMarkup(
      <ExportForm
        mode="csv"
        actionUrl="/api/exports/csv"
        boutiques={BOUTIQUES}
        equipements={EQUIPEMENTS}
        defaultDateISO={DEFAULT_DATE}
      />
    );
    expect(html).toContain('action="/api/exports/csv"');
    expect(html).toContain('method="get"');
    expect(html).toContain('data-testid="export-form-date-from"');
    expect(html).toContain('data-testid="export-form-date-to"');
    expect(html).toContain('data-testid="export-form-boutique"');
    expect(html).toContain('data-testid="export-form-equipement"');
    expect(html).toContain('Toutes les boutiques accessibles');
  });

  it('should render PDF mode with single date and required boutique', () => {
    const html = renderToStaticMarkup(
      <ExportForm
        mode="pdf"
        actionUrl="/api/exports/pdf"
        boutiques={BOUTIQUES}
        defaultDateISO={DEFAULT_DATE}
      />
    );
    expect(html).toContain('action="/api/exports/pdf"');
    expect(html).toContain('data-testid="export-form-date"');
    expect(html).toContain('Selectionner une boutique');
    expect(html).not.toContain('data-testid="export-form-date-from"');
    expect(html).not.toContain('data-testid="export-form-equipement"');
  });

  it('should render error message when errorMessage prop is set', () => {
    const html = renderToStaticMarkup(
      <ExportForm
        mode="csv"
        actionUrl="/api/exports/csv"
        boutiques={BOUTIQUES}
        defaultDateISO={DEFAULT_DATE}
        errorMessage="Periode trop large"
      />
    );
    expect(html).toContain('data-testid="export-form-error"');
    expect(html).toContain('Periode trop large');
    expect(html).toContain('role="alert"');
  });

  it('should mark required inputs with aria-required="true" (CSV mode)', () => {
    const html = renderToStaticMarkup(
      <ExportForm
        mode="csv"
        actionUrl="/api/exports/csv"
        boutiques={BOUTIQUES}
        defaultDateISO={DEFAULT_DATE}
      />
    );
    // Date inputs are required in CSV mode. The regex matches `aria-required`
    // and `data-testid` on the same input tag (any attribute order).
    expect(html).toMatch(
      /<input[^>]*aria-required="true"[^>]*data-testid="export-form-date-from"/
    );
    expect(html).toMatch(
      /<input[^>]*aria-required="true"[^>]*data-testid="export-form-date-to"/
    );
    // Boutique is NOT required in CSV mode (optional)
    expect(html).not.toMatch(
      /<select[^>]*aria-required="true"[^>]*data-testid="export-form-boutique"/
    );
  });

  it('should mark required boutique with aria-required and use abbr for required marker (PDF mode)', () => {
    const html = renderToStaticMarkup(
      <ExportForm
        mode="pdf"
        actionUrl="/api/exports/pdf"
        boutiques={BOUTIQUES}
        defaultDateISO={DEFAULT_DATE}
      />
    );
    expect(html).toMatch(
      /<input[^>]*aria-required="true"[^>]*data-testid="export-form-date"/
    );
    expect(html).toMatch(
      /<select[^>]*aria-required="true"[^>]*data-testid="export-form-boutique"/
    );
    // Required marker is a screen-reader friendly abbr, not a stray "*"
    expect(html).toContain('<abbr');
    expect(html).toContain('title="champ obligatoire"');
    expect(html).toContain('aria-label="champ obligatoire"');
  });

  it('should link form to error message via aria-describedby when error is set', () => {
    const html = renderToStaticMarkup(
      <ExportForm
        mode="csv"
        actionUrl="/api/exports/csv"
        boutiques={BOUTIQUES}
        defaultDateISO={DEFAULT_DATE}
        errorMessage="Periode trop large"
      />
    );
    expect(html).toMatch(/<form[^>]*aria-describedby="export-form-error"/);
    expect(html).toMatch(/id="export-form-error"/);
  });

  it('should NOT set aria-describedby on form when no error', () => {
    const html = renderToStaticMarkup(
      <ExportForm
        mode="csv"
        actionUrl="/api/exports/csv"
        boutiques={BOUTIQUES}
        defaultDateISO={DEFAULT_DATE}
      />
    );
    expect(html).not.toMatch(/<form[^>]*aria-describedby=/);
  });

  it('should use the custom submit label when provided', () => {
    const html = renderToStaticMarkup(
      <ExportForm
        mode="pdf"
        actionUrl="/api/exports/pdf"
        boutiques={BOUTIQUES}
        defaultDateISO={DEFAULT_DATE}
        submitLabel="Editer le registre journalier"
      />
    );
    expect(html).toContain('Editer le registre journalier');
  });

  it('should default submit label per mode when not provided', () => {
    const csvHtml = renderToStaticMarkup(
      <ExportForm
        mode="csv"
        actionUrl="/api/exports/csv"
        boutiques={BOUTIQUES}
        defaultDateISO={DEFAULT_DATE}
      />
    );
    expect(csvHtml).toContain('Telecharger le CSV');
    const pdfHtml = renderToStaticMarkup(
      <ExportForm
        mode="pdf"
        actionUrl="/api/exports/pdf"
        boutiques={BOUTIQUES}
        defaultDateISO={DEFAULT_DATE}
      />
    );
    expect(pdfHtml).toContain('Telecharger le PDF');
  });
});
