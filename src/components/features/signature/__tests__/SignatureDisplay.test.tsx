import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SignatureRow } from '@/types/signature';
import { SignatureDisplay } from '../SignatureDisplay';

/**
 * Tests SignatureDisplay (US-SIG-001).
 *
 * Server Component pur. SSR :
 *   - image avec src + alt accessible (nom + date FR),
 *   - meta : nom, role, date au format JJ/MM/AAAA,
 *   - <time dateTime> au format ISO,
 *   - data-testid principaux.
 */

function buildSignature(overrides: Partial<SignatureRow> = {}): SignatureRow {
  return {
    id: 'sig-1',
    boutiqueId: 'b1',
    dateISO: '2026-05-27',
    signataireId: 'u1',
    signataireName: 'Lea Martin',
    signataireRoleSnapshot: 'SALARIE',
    imageUrl: 'https://blob.example.com/signatures/sig-1.png',
    signedAt: new Date('2026-05-27T10:30:00.000Z'),
    ...overrides,
  };
}

describe('[Signature] SignatureDisplay', () => {
  it('should render the signature image with the expected src', () => {
    const html = renderToStaticMarkup(
      <SignatureDisplay signature={buildSignature()} />
    );
    expect(html).toContain('data-testid="signature-display"');
    expect(html).toContain('data-testid="signature-display-image"');
    expect(html).toContain(
      'src="https://blob.example.com/signatures/sig-1.png"'
    );
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
  });

  it('should set referrerPolicy="no-referrer" on the image (privacy hardening)', () => {
    const html = renderToStaticMarkup(
      <SignatureDisplay signature={buildSignature()} />
    );
    // React SSR conserve l'attribut JSX en camelCase ; le navigateur le
    // normalise en `referrerpolicy` (case-insensitive HTML5).
    expect(html.toLowerCase()).toContain('referrerpolicy="no-referrer"');
  });

  it('should render an accessible alt text combining signataireName and FR date', () => {
    const html = renderToStaticMarkup(
      <SignatureDisplay signature={buildSignature()} />
    );
    expect(html).toContain(
      'alt="Signature manuscrite de Lea Martin le 27/05/2026"'
    );
    expect(html).toContain(
      'aria-label="Signature manuscrite de Lea Martin le 27/05/2026"'
    );
  });

  it('should expose the signataireName, role and FR date in the meta block', () => {
    const html = renderToStaticMarkup(
      <SignatureDisplay signature={buildSignature()} />
    );
    expect(html).toContain('data-testid="signature-display-meta"');
    expect(html).toContain('Lea Martin');
    expect(html).toContain('SALARIE');
    expect(html).toContain('27/05/2026');
    expect(html).toContain('dateTime="2026-05-27"');
  });

  it('should respect the signataireRoleSnapshot for RESPONSABLE', () => {
    const html = renderToStaticMarkup(
      <SignatureDisplay
        signature={buildSignature({ signataireRoleSnapshot: 'RESPONSABLE' })}
      />
    );
    expect(html).toContain('RESPONSABLE');
  });

  it('should honor a custom testId prop', () => {
    const html = renderToStaticMarkup(
      <SignatureDisplay signature={buildSignature()} testId="my-display" />
    );
    expect(html).toContain('data-testid="my-display"');
    expect(html).toContain('data-testid="my-display-image"');
    expect(html).toContain('data-testid="my-display-meta"');
  });
});
