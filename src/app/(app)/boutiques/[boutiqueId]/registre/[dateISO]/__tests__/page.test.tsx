/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { RegistreJournalier } from '@/types/export';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`__REDIRECT__:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('__NOT_FOUND__');
  }),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/services/export.service', () => ({
  readRegistreJournalier: vi.fn(),
}));

vi.mock('@/lib/services/signature.service', () => ({
  getSignatureForRegistre: vi.fn(async () => ({ success: true, data: null })),
}));

vi.mock('@/app/actions/signature', () => ({
  signatureUploadAction: vi.fn(),
}));

// `SignatureSection` est un Server Component async : `renderToStaticMarkup`
// ne supporte pas la suspension. On le remplace par un stub synchrone qui
// preserve le `testId` propage par la page pour assertions.
vi.mock('@/components/features/signature/SignatureSection', () => ({
  SignatureSection: ({
    testId,
  }: {
    readonly testId?: string;
    readonly boutiqueId: string;
    readonly dateISO: string;
  }) => (
    <section data-testid={testId ?? 'signature-section'}>
      signature-section-stub
    </section>
  ),
}));

import { auth } from '@/lib/auth';
import { readRegistreJournalier } from '@/lib/services/export.service';
import { getSignatureForRegistre } from '@/lib/services/signature.service';
import RegistreDetailPage from '../page';

const BOUTIQUE_ID = 'b1';
const DATE_ISO = '2026-05-27';

const SALARIE_SESSION = {
  user: {
    id: 's1',
    role: 'SALARIE' as const,
    email: 's1@mg.test',
    name: 'Lea',
  },
};

const ADMIN_SESSION = {
  user: { id: 'a1', role: 'ADMIN' as const, email: 'a1@mg.test', name: 'Adm' },
};

const RESPONSABLE_SESSION = {
  user: {
    id: 'r1',
    role: 'RESPONSABLE' as const,
    email: 'r1@mg.test',
    name: 'Resp',
  },
};

function buildRegistre(
  overrides: Partial<RegistreJournalier> = {}
): RegistreJournalier {
  return {
    dateISO: DATE_ISO,
    boutique: {
      id: BOUTIQUE_ID,
      nom: 'MG Bastille',
      adresse: null,
      ville: null,
    },
    generatedBy: { nom: 'Lea', role: 'SALARIE' },
    generatedAt: new Date('2026-05-27T10:00:00Z'),
    equipements: [
      {
        equipementId: 'e1',
        equipementNom: 'CGL-01',
        equipementType: 'CONGELATEUR',
        seuilMin: -25,
        seuilMax: -18,
        creneaux: [
          {
            creneau: 'MATIN',
            temperature: -20,
            commentaire: null,
            alerteHorsSeuils: false,
            salarieNom: 'Lea',
            heureSaisie: '08:30',
          },
          {
            creneau: 'MIDI',
            temperature: null,
            commentaire: null,
            alerteHorsSeuils: false,
            salarieNom: null,
            heureSaisie: null,
          },
          {
            creneau: 'SOIR',
            temperature: null,
            commentaire: null,
            alerteHorsSeuils: false,
            salarieNom: null,
            heureSaisie: null,
          },
        ],
      },
    ],
    alertes: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSignatureForRegistre).mockResolvedValue({
    success: true,
    data: null,
  });
});

describe('[RegistreDetailPage]', () => {
  it('should redirect to /login when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as any);
    await expect(
      RegistreDetailPage({
        params: Promise.resolve({ boutiqueId: BOUTIQUE_ID, dateISO: DATE_ISO }),
      })
    ).rejects.toThrow('__REDIRECT__:/login');
  });

  it('should call notFound when the boutique is out of scope (service returns BOUTIQUE_NOT_FOUND)', async () => {
    vi.mocked(auth).mockResolvedValue(SALARIE_SESSION as any);
    vi.mocked(readRegistreJournalier).mockResolvedValue({
      success: false,
      error: 'BOUTIQUE_NOT_FOUND',
    });

    await expect(
      RegistreDetailPage({
        params: Promise.resolve({ boutiqueId: BOUTIQUE_ID, dateISO: DATE_ISO }),
      })
    ).rejects.toThrow('__NOT_FOUND__');
  });

  it('should render the registre detail with releves and signature section when service succeeds', async () => {
    vi.mocked(auth).mockResolvedValue(SALARIE_SESSION as any);
    vi.mocked(readRegistreJournalier).mockResolvedValue({
      success: true,
      data: buildRegistre(),
    });

    const element = await RegistreDetailPage({
      params: Promise.resolve({ boutiqueId: BOUTIQUE_ID, dateISO: DATE_ISO }),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="registre-detail-page"');
    expect(html).toContain('data-testid="registre-detail-releves-table"');
    expect(html).toContain('CGL-01');
    expect(html).toContain('Registre du 27/05/2026');
    expect(html).toContain('data-testid="registre-detail-signature"');
  });

  it('should render the empty state when no releves exist', async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(readRegistreJournalier).mockResolvedValue({
      success: true,
      data: buildRegistre({ equipements: [] }),
    });

    const element = await RegistreDetailPage({
      params: Promise.resolve({ boutiqueId: BOUTIQUE_ID, dateISO: DATE_ISO }),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="registre-detail-releves-empty"');
  });

  it('should render the export PDF link with the right query params', async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(readRegistreJournalier).mockResolvedValue({
      success: true,
      data: buildRegistre(),
    });

    const element = await RegistreDetailPage({
      params: Promise.resolve({ boutiqueId: BOUTIQUE_ID, dateISO: DATE_ISO }),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="registre-detail-export-pdf"');
    expect(html).toContain(
      `/api/exports/pdf?boutiqueId=${BOUTIQUE_ID}&amp;date=${DATE_ISO}`
    );
  });

  it('should allow SALARIE to access the page (so they can sign the registre)', async () => {
    vi.mocked(auth).mockResolvedValue(SALARIE_SESSION as any);
    vi.mocked(readRegistreJournalier).mockResolvedValue({
      success: true,
      data: buildRegistre(),
    });

    const element = await RegistreDetailPage({
      params: Promise.resolve({ boutiqueId: BOUTIQUE_ID, dateISO: DATE_ISO }),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="registre-detail-page"');
    expect(html).toContain('data-testid="registre-detail-signature"');
  });

  it('should allow RESPONSABLE to access the page', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(readRegistreJournalier).mockResolvedValue({
      success: true,
      data: buildRegistre(),
    });

    const element = await RegistreDetailPage({
      params: Promise.resolve({ boutiqueId: BOUTIQUE_ID, dateISO: DATE_ISO }),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="registre-detail-page"');
  });

  it('should allow ADMIN to access the page', async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(readRegistreJournalier).mockResolvedValue({
      success: true,
      data: buildRegistre(),
    });

    const element = await RegistreDetailPage({
      params: Promise.resolve({ boutiqueId: BOUTIQUE_ID, dateISO: DATE_ISO }),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="registre-detail-page"');
  });
});
