/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SignatureRow, SignatureViewer } from '@/types/signature';

/**
 * Tests SignatureSection (US-SIG-001).
 *
 * Server Component async qui orchestre 3 cas selon
 * `getSignatureForRegistre` + role du viewer :
 *   1. Signature existante -> SignatureDisplay.
 *   2. Pas de signature ET viewer autorise (SALARIE/RESPONSABLE) -> Form.
 *   3. Pas de signature ET viewer non autorise (ADMIN) -> message attente.
 *
 * On mock le service signature pour decoupler l'unit test de la pile DB.
 * On mock aussi la Server Action (chaine next-auth) consommee par
 * `SignatureUploadForm`.
 */

vi.mock('@/lib/services/signature.service', () => ({
  getSignatureForRegistre: vi.fn(),
}));

// SignatureUploadForm -> uses signature server action -> auth chain.
vi.mock('@/app/actions/signature', () => ({
  signatureUploadAction: vi.fn(),
}));

import { getSignatureForRegistre } from '@/lib/services/signature.service';
import { SignatureSection } from '../SignatureSection';

const BOUTIQUE_ID = 'b1';
const DATE_ISO = '2026-05-27';

const SALARIE_VIEWER: SignatureViewer = { id: 's1', role: 'SALARIE' };
const RESPONSABLE_VIEWER: SignatureViewer = { id: 'r1', role: 'RESPONSABLE' };
const ADMIN_VIEWER: SignatureViewer = { id: 'a1', role: 'ADMIN' };

function buildSignature(overrides: Partial<SignatureRow> = {}): SignatureRow {
  return {
    id: 'sig-1',
    boutiqueId: BOUTIQUE_ID,
    dateISO: DATE_ISO,
    signataireId: 's1',
    signataireName: 'Lea Martin',
    signataireRoleSnapshot: 'SALARIE',
    imageUrl: 'https://blob.example.com/signatures/sig-1.png',
    signedAt: new Date('2026-05-27T10:30:00.000Z'),
    ...overrides,
  };
}

async function renderSection(props: {
  readonly viewer: SignatureViewer;
}): Promise<string> {
  const element = await SignatureSection({
    boutiqueId: BOUTIQUE_ID,
    dateISO: DATE_ISO,
    viewer: props.viewer,
  });
  return renderToStaticMarkup(element as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[Signature] SignatureSection', () => {
  it('should render the SignatureDisplay when a signature already exists', async () => {
    vi.mocked(getSignatureForRegistre).mockResolvedValue({
      success: true,
      data: buildSignature(),
    });

    const html = await renderSection({ viewer: ADMIN_VIEWER });

    expect(html).toContain('data-testid="signature-section"');
    expect(html).toContain('data-testid="signature-section-display"');
    expect(html).toContain('Lea Martin');
    expect(html).not.toContain('data-testid="signature-section-form"');
    expect(html).not.toContain('data-testid="signature-section-empty"');
  });

  it('should render the upload form when no signature exists and viewer is SALARIE', async () => {
    vi.mocked(getSignatureForRegistre).mockResolvedValue({
      success: true,
      data: null,
    });

    const html = await renderSection({ viewer: SALARIE_VIEWER });

    expect(html).toContain('data-testid="signature-section-form"');
    expect(html).not.toContain('data-testid="signature-section-display"');
    expect(html).not.toContain('data-testid="signature-section-empty"');
  });

  it('should render the upload form when no signature exists and viewer is RESPONSABLE', async () => {
    vi.mocked(getSignatureForRegistre).mockResolvedValue({
      success: true,
      data: null,
    });

    const html = await renderSection({ viewer: RESPONSABLE_VIEWER });

    expect(html).toContain('data-testid="signature-section-form"');
  });

  it('should render the empty status when no signature exists and viewer is ADMIN', async () => {
    vi.mocked(getSignatureForRegistre).mockResolvedValue({
      success: true,
      data: null,
    });

    const html = await renderSection({ viewer: ADMIN_VIEWER });

    expect(html).toContain('data-testid="signature-section-empty"');
    expect(html).toContain('attente de signature');
    expect(html).not.toContain('data-testid="signature-section-form"');
    expect(html).not.toContain('data-testid="signature-section-display"');
  });

  it('should fall back to the empty status when the service returns an error (defensive)', async () => {
    vi.mocked(getSignatureForRegistre).mockResolvedValue({
      success: false,
      error: 'BOUTIQUE_NOT_FOUND',
    });

    const html = await renderSection({ viewer: ADMIN_VIEWER });

    expect(html).toContain('data-testid="signature-section-empty"');
  });
});
