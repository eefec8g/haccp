import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildRegistreJournalierPdf,
  buildSignatureFooter,
  fetchSignatureImage,
} from './pdf-builder';
import type { RegistreJournalierForExport } from '@/types/export';

const ALLOWED_HOST = 'store.public.blob.vercel-storage.com';
const ALLOWED_URL = `https://${ALLOWED_HOST}/sig.png`;
const PNG_MAGIC = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function makeFetchResponse({
  bytes = PNG_MAGIC,
  contentType = 'image/png',
  contentLength,
  status = 200,
}: {
  bytes?: Uint8Array;
  contentType?: string;
  contentLength?: number;
  status?: number;
} = {}): Response {
  const headers = new Headers();
  headers.set('content-type', contentType);
  headers.set('content-length', String(contentLength ?? bytes.byteLength));
  const copy = new Uint8Array(bytes);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    arrayBuffer: async () => copy.buffer,
  } as unknown as Response;
}

function makeRegistre(
  overrides: Partial<RegistreJournalierForExport> = {}
): RegistreJournalierForExport {
  return {
    dateISO: '2026-05-27',
    boutique: {
      id: 'b1',
      nom: 'MG Paris 11',
      adresse: '12 rue de la Roquette',
      ville: '75011 Paris',
    },
    generatedBy: { nom: 'Jane Doe', role: 'RESPONSABLE' },
    generatedAt: new Date('2026-05-27T10:30:00Z'),
    equipements: [
      {
        equipementId: 'e1',
        equipementNom: 'Congelateur CGL-01',
        equipementType: 'CONGELATEUR',
        seuilMin: -25,
        seuilMax: -18,
        creneaux: [
          {
            creneau: 'MATIN',
            temperature: -20.5,
            commentaire: null,
            alerteHorsSeuils: false,
            salarieNom: 'Nina',
            heureSaisie: '08:30',
          },
          {
            creneau: 'MIDI',
            temperature: -10,
            commentaire: 'Porte ouverte',
            alerteHorsSeuils: true,
            salarieNom: 'Nina',
            heureSaisie: '13:45',
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
    alertes: [
      {
        alerteId: 'a1',
        equipementNom: 'Congelateur CGL-01',
        creneau: 'MIDI',
        temperature: -10,
        seuilMin: -25,
        seuilMax: -18,
        status: 'RESOLUE',
        commentaireResolution:
          'Porte refermee apres livraison, temperature revenue a -20',
        resoluParNom: 'Manager Dupont',
        resoluAt: new Date('2026-05-27T15:00:00Z'),
      },
    ],
    signature: null,
    ...overrides,
  };
}

describe('[pdf-builder]', () => {
  it('should return a non-empty Buffer that starts with the PDF magic bytes', async () => {
    const buf = await buildRegistreJournalierPdf(makeRegistre());
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('should still produce a valid PDF when there are no releves and no alertes', async () => {
    const buf = await buildRegistreJournalierPdf(
      makeRegistre({ equipements: [], alertes: [] })
    );
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(500);
  });

  it('should produce a valid PDF for a boutique without address', async () => {
    const buf = await buildRegistreJournalierPdf(
      makeRegistre({
        boutique: {
          id: 'b1',
          nom: 'MG Bastille',
          adresse: null,
          ville: null,
        },
      })
    );
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});

describe('[pdf-builder] buildSignatureFooter', () => {
  it('should return a "Registre non signe" message when no signature is provided', () => {
    const content = buildSignatureFooter({
      signature: null,
      imageDataUrl: null,
    });
    expect(JSON.stringify(content)).toContain('Registre non signe');
  });

  it('should return a "Signature indisponible" block when signature exists but image fetch failed', () => {
    const content = buildSignatureFooter({
      signature: {
        imageUrl: 'https://blob.example.com/sig-1.png',
        signataireName: 'Lea Martin',
        signataireRoleSnapshot: 'SALARIE',
        signedAt: new Date('2026-05-27T10:30:00Z'),
      },
      imageDataUrl: null,
    });
    const json = JSON.stringify(content);
    expect(json).toContain('Signature indisponible');
    expect(json).toContain('Lea Martin');
    expect(json).toContain('SALARIE');
  });

  it('should embed the signature image data URL when both signature and dataUrl are provided', () => {
    const content = buildSignatureFooter({
      signature: {
        imageUrl: 'https://blob.example.com/sig-1.png',
        signataireName: 'Sophie Dupont',
        signataireRoleSnapshot: 'RESPONSABLE',
        signedAt: new Date('2026-05-27T11:00:00Z'),
      },
      imageDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    });
    const json = JSON.stringify(content);
    expect(json).toContain('data:image/png;base64,iVBORw0KGgo=');
    expect(json).toContain('Signature du registre');
    expect(json).toContain('Sophie Dupont');
    expect(json).toContain('RESPONSABLE');
  });
});

describe('[pdf-builder] fetchSignatureImage', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should return a base64 data URL when fetch succeeds (allowed host + valid PNG)', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        makeFetchResponse({ bytes: PNG_MAGIC })
      ) as unknown as typeof fetch;

    const url = await fetchSignatureImage(ALLOWED_URL);
    expect(url).not.toBeNull();
    expect(url?.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('should pass cache: "force-cache" to fetch (signatures are immutable)', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        makeFetchResponse({ bytes: PNG_MAGIC })
      ) as unknown as typeof fetch;
    global.fetch = fetchSpy;

    await fetchSignatureImage(ALLOWED_URL);

    expect(fetchSpy).toHaveBeenCalledWith(
      ALLOWED_URL,
      expect.objectContaining({ cache: 'force-cache' })
    );
  });

  it('should pass redirect: "error" to fetch (defense en profondeur SSRF)', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        makeFetchResponse({ bytes: PNG_MAGIC })
      ) as unknown as typeof fetch;
    global.fetch = fetchSpy;

    await fetchSignatureImage(ALLOWED_URL);

    expect(fetchSpy).toHaveBeenCalledWith(
      ALLOWED_URL,
      expect.objectContaining({ redirect: 'error' })
    );
  });

  it('should pass an AbortSignal instance to fetch (timeout protection)', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        makeFetchResponse({ bytes: PNG_MAGIC })
      ) as unknown as typeof fetch;
    global.fetch = fetchSpy;

    await fetchSignatureImage(ALLOWED_URL);

    const call = (fetchSpy as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0];
    const options = call?.[1] as RequestInit | undefined;
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(options?.cache).toBe('force-cache');
    expect(options?.redirect).toBe('error');
  });

  it('should return null when the URL uses http:// (downgrade protection)', async () => {
    const fetchSpy = vi.fn() as unknown as typeof fetch;
    global.fetch = fetchSpy;

    const url = await fetchSignatureImage(`http://${ALLOWED_HOST}/sig.png`);
    expect(url).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should return null when the host is NOT a Vercel Blob hostname (SSRF protection)', async () => {
    const fetchSpy = vi.fn() as unknown as typeof fetch;
    global.fetch = fetchSpy;

    const url = await fetchSignatureImage('https://attacker.example.com/x.png');
    expect(url).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should return null when the URL is malformed', async () => {
    const fetchSpy = vi.fn() as unknown as typeof fetch;
    global.fetch = fetchSpy;
    const url = await fetchSignatureImage('not-a-url');
    expect(url).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should return null when content-type is not image/png', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        makeFetchResponse({ contentType: 'image/jpeg' })
      ) as unknown as typeof fetch;

    const url = await fetchSignatureImage(ALLOWED_URL);
    expect(url).toBeNull();
  });

  it('should accept content-type "image/png; charset=..." (startsWith)', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      makeFetchResponse({
        bytes: PNG_MAGIC,
        contentType: 'image/png; charset=binary',
      })
    ) as unknown as typeof fetch;

    const url = await fetchSignatureImage(ALLOWED_URL);
    expect(url).not.toBeNull();
  });

  it('should return null when content-length is missing', async () => {
    const headers = new Headers();
    headers.set('content-type', 'image/png');
    const response = {
      ok: true,
      status: 200,
      headers,
      arrayBuffer: async () => PNG_MAGIC.buffer,
    } as unknown as Response;
    global.fetch = vi
      .fn()
      .mockResolvedValue(response) as unknown as typeof fetch;

    const url = await fetchSignatureImage(ALLOWED_URL);
    expect(url).toBeNull();
  });

  it('should return null when content-length exceeds MAX_SIGNATURE_BYTES (DoS)', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      makeFetchResponse({
        bytes: PNG_MAGIC,
        contentLength: 1_000_000,
      })
    ) as unknown as typeof fetch;

    const url = await fetchSignatureImage(ALLOWED_URL);
    expect(url).toBeNull();
  });

  it('should return null when magic bytes are invalid (declared PNG but JPEG bytes)', async () => {
    const jpegBytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x00, 0x00,
    ]);
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        makeFetchResponse({ bytes: jpegBytes })
      ) as unknown as typeof fetch;

    const url = await fetchSignatureImage(ALLOWED_URL);
    expect(url).toBeNull();
  });

  it('should return null when fetch responds with a non-2xx status', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        makeFetchResponse({ status: 404 })
      ) as unknown as typeof fetch;
    const url = await fetchSignatureImage(ALLOWED_URL);
    expect(url).toBeNull();
  });

  it('should return null when fetch throws (network error, timeout)', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new Error('network')) as unknown as typeof fetch;
    const url = await fetchSignatureImage(ALLOWED_URL);
    expect(url).toBeNull();
  });
});

describe('[pdf-builder] buildRegistreJournalierPdf with signature', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should generate a valid PDF even when the signature fetch fails', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new Error('blob down')) as unknown as typeof fetch;

    const buf = await buildRegistreJournalierPdf(
      makeRegistre({
        signature: {
          imageUrl: ALLOWED_URL,
          signataireName: 'Sophie',
          signataireRoleSnapshot: 'RESPONSABLE',
          signedAt: new Date('2026-05-27T10:00:00Z'),
        },
      })
    );
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
