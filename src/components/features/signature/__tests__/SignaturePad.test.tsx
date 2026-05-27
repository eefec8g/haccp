import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@/lib/constants/signature';
import { SignaturePad } from '../SignaturePad';

/**
 * Tests SignaturePad (US-SIG-001).
 *
 * Client Component manipulant un canvas + pointer events. SSR
 * (`renderToStaticMarkup`) ne declenche pas les effets ni les events,
 * donc on couvre les invariants statiques :
 *   - rendu canvas avec width/height attendus,
 *   - a11y : role="img", aria-label, aria-describedby,
 *   - boutons Effacer/Signer presents avec data-testid,
 *   - bouton "Signer" disabled tant que le canvas est vide (isEmpty=true),
 *   - prop `testId` custom respectee,
 *   - prop `disabled` propage.
 *
 * Le pipeline interactif (pointerdown -> stroke -> toBlob) est verifie
 * manuellement et via tests E2E Playwright (hors perimetre unit jsdom).
 */

describe('[Signature] SignaturePad', () => {
  it('should render the canvas with the expected dimensions and aria attributes', () => {
    const html = renderToStaticMarkup(<SignaturePad onSign={vi.fn()} />);
    expect(html).toContain('data-testid="signature-pad"');
    expect(html).toContain('data-testid="signature-pad-canvas"');
    expect(html).toContain(`width="${CANVAS_WIDTH}"`);
    expect(html).toContain(`height="${CANVAS_HEIGHT}"`);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Zone de signature"');
  });

  it('should constrain the canvas visual to the 5:2 native ratio on all viewports', () => {
    // Sans aspect-ratio CSS, sur mobile etroit le canvas etait deforme
    // visuellement (width=500 ecrasee, height=200 conservee). La regle
    // CSS `aspect-[5/2]` corrige et `getCanvasPoint` recalibre toujours
    // via `getBoundingClientRect`, donc la precision du trace est intacte.
    const html = renderToStaticMarkup(<SignaturePad onSign={vi.fn()} />);
    expect(html).toContain('aspect-[5/2]');
  });

  it('should render both action buttons with French labels', () => {
    const html = renderToStaticMarkup(<SignaturePad onSign={vi.fn()} />);
    expect(html).toContain('data-testid="signature-pad-clear"');
    expect(html).toContain('data-testid="signature-pad-submit"');
    expect(html).toContain('Effacer');
    expect(html).toContain('Signer le registre');
  });

  function extractTagAroundTestId(html: string, testId: string): string {
    const marker = `data-testid="${testId}"`;
    const idx = html.indexOf(marker);
    if (idx === -1) {
      return '';
    }
    const tagStart = html.lastIndexOf('<', idx);
    const tagEnd = html.indexOf('>', idx);
    return html.slice(tagStart, tagEnd + 1);
  }

  it('should disable the submit button when the canvas is empty (isEmpty=true)', () => {
    const html = renderToStaticMarkup(<SignaturePad onSign={vi.fn()} />);
    const submitTag = extractTagAroundTestId(html, 'signature-pad-submit');
    expect(submitTag).toContain('disabled=""');
  });

  it('should disable the clear button when the canvas is empty (isEmpty=true)', () => {
    const html = renderToStaticMarkup(<SignaturePad onSign={vi.fn()} />);
    const clearTag = extractTagAroundTestId(html, 'signature-pad-clear');
    expect(clearTag).toContain('disabled=""');
  });

  it('should honor a custom testId prop on the wrapper and child elements', () => {
    const html = renderToStaticMarkup(
      <SignaturePad onSign={vi.fn()} testId="my-sig" />
    );
    expect(html).toContain('data-testid="my-sig"');
    expect(html).toContain('data-testid="my-sig-canvas"');
    expect(html).toContain('data-testid="my-sig-clear"');
    expect(html).toContain('data-testid="my-sig-submit"');
  });

  it('should disable both buttons when the disabled prop is true', () => {
    const html = renderToStaticMarkup(
      <SignaturePad onSign={vi.fn()} disabled />
    );
    expect(extractTagAroundTestId(html, 'signature-pad-clear')).toContain(
      'disabled=""'
    );
    expect(extractTagAroundTestId(html, 'signature-pad-submit')).toContain(
      'disabled=""'
    );
  });

  it('should provide visible textual instructions for the user', () => {
    const html = renderToStaticMarkup(<SignaturePad onSign={vi.fn()} />);
    expect(html).toContain('Dessinez votre signature');
  });
});
