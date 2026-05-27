import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const { putMock, delMock } = vi.hoisted(() => ({
  putMock: vi.fn(),
  delMock: vi.fn(),
}));

vi.mock('@vercel/blob', () => ({
  put: putMock,
  del: delMock,
}));

vi.mock('@/lib/prisma', () => {
  const signature = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  };
  return {
    db: {
      signature,
      $transaction: vi.fn(),
    },
  };
});

vi.mock('@/lib/permissions', () => ({
  getAccessibleBoutiqueIds: vi.fn(),
}));

vi.mock('@/lib/services/audit-log.service', () => ({
  logAudit: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { db } from '@/lib/prisma';
import { getAccessibleBoutiqueIds } from '@/lib/permissions';
import { logAudit } from '@/lib/services/audit-log.service';
import {
  getSignatureForRegistre,
  listSignaturesForBoutique,
  uploadSignatureToRegistre,
} from './signature.service';
import type { SignatureViewer } from '@/types/signature';

const BOUTIQUE_ID = '11111111-1111-4111-8111-111111111111';
const DATE_ISO = '2026-05-27';
const SIGNATURE_ID = 'sig-1';
const BLOB_URL = 'https://blob.example/signatures/key.png';

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

function salarieUser(): SignatureViewer {
  return { id: 'sal-1', role: 'SALARIE' };
}
function responsableUser(): SignatureViewer {
  return { id: 'resp-1', role: 'RESPONSABLE' };
}
function adminUser(): SignatureViewer {
  return { id: 'adm-1', role: 'ADMIN' };
}

function makeFile({
  size = 50_000,
  type = 'image/png',
  name = 'signature.png',
  bytes = PNG_BYTES,
}: {
  size?: number;
  type?: string;
  name?: string;
  bytes?: Uint8Array;
} = {}): File {
  const file = {
    size,
    type,
    name,
    arrayBuffer: vi
      .fn()
      .mockResolvedValue(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        )
      ),
    slice: vi.fn(),
    stream: vi.fn(),
    text: vi.fn(),
  } as unknown as File;
  return file;
}

function noExistingSignature(): void {
  vi.mocked(db.signature.findUnique).mockResolvedValue(null as never);
}

function existingSignature(): void {
  vi.mocked(db.signature.findUnique).mockResolvedValue({
    id: SIGNATURE_ID,
  } as never);
}

interface TxOptions {
  readonly throwError?: unknown;
  readonly createdId?: string;
  readonly signedAt?: Date;
}

function setupTransactionToInvokeCallback(options: TxOptions = {}): void {
  const {
    throwError,
    createdId = SIGNATURE_ID,
    signedAt = new Date('2026-05-27T10:00:00Z'),
  } = options;
  vi.mocked(db.$transaction).mockImplementation(
    async <T>(arg: unknown, _opts?: unknown): Promise<T> => {
      if (typeof arg === 'function') {
        const tx = {
          signature: {
            create: vi.fn(async () => {
              if (throwError) {
                throw throwError;
              }
              return { id: createdId, signedAt };
            }),
          },
        };
        return arg(tx) as Promise<T>;
      }
      return Promise.resolve(arg as T);
    }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  putMock.mockReset();
  delMock.mockReset();
});

describe('[signature.service.uploadSignatureToRegistre]', () => {
  it('should return FORBIDDEN when viewer is ADMIN (only SALARIE/RESPONSABLE may sign)', async () => {
    const result = await uploadSignatureToRegistre({
      viewer: adminUser(),
      boutiqueId: BOUTIQUE_ID,
      dateISO: DATE_ISO,
      file: makeFile(),
      metadata: { ipAddress: null, userAgent: null },
    });

    expect(result).toEqual({ success: false, error: 'FORBIDDEN' });
    expect(getAccessibleBoutiqueIds).not.toHaveBeenCalled();
    expect(putMock).not.toHaveBeenCalled();
  });

  it('should return BOUTIQUE_NOT_FOUND when the boutique is outside scope', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue(['b-foreign']);

    const result = await uploadSignatureToRegistre({
      viewer: salarieUser(),
      boutiqueId: BOUTIQUE_ID,
      dateISO: DATE_ISO,
      file: makeFile(),
      metadata: { ipAddress: null, userAgent: null },
    });

    expect(result).toEqual({ success: false, error: 'BOUTIQUE_NOT_FOUND' });
    expect(putMock).not.toHaveBeenCalled();
  });

  it('should return TOO_LARGE when the file exceeds MAX_SIGNATURE_BYTES', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);

    const result = await uploadSignatureToRegistre({
      viewer: salarieUser(),
      boutiqueId: BOUTIQUE_ID,
      dateISO: DATE_ISO,
      file: makeFile({ size: 300_000 }),
      metadata: { ipAddress: null, userAgent: null },
    });

    expect(result).toEqual({ success: false, error: 'TOO_LARGE' });
    expect(putMock).not.toHaveBeenCalled();
  });

  it('should return INVALID_MIME when the declared MIME is not image/png', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);

    const result = await uploadSignatureToRegistre({
      viewer: salarieUser(),
      boutiqueId: BOUTIQUE_ID,
      dateISO: DATE_ISO,
      file: makeFile({ type: 'image/jpeg' }),
      metadata: { ipAddress: null, userAgent: null },
    });

    expect(result).toEqual({ success: false, error: 'INVALID_MIME' });
    expect(putMock).not.toHaveBeenCalled();
  });

  it('should return MAGIC_BYTES_FAIL when the file is declared PNG but bytes are JPEG', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);

    const result = await uploadSignatureToRegistre({
      viewer: salarieUser(),
      boutiqueId: BOUTIQUE_ID,
      dateISO: DATE_ISO,
      file: makeFile({ type: 'image/png', bytes: JPEG_BYTES }),
      metadata: { ipAddress: null, userAgent: null },
    });

    expect(result).toEqual({ success: false, error: 'MAGIC_BYTES_FAIL' });
    expect(putMock).not.toHaveBeenCalled();
  });

  it('should return SIGNATURE_ALREADY_EXISTS without uploading when a signature exists (pre-check)', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    existingSignature();

    const result = await uploadSignatureToRegistre({
      viewer: salarieUser(),
      boutiqueId: BOUTIQUE_ID,
      dateISO: DATE_ISO,
      file: makeFile(),
      metadata: { ipAddress: null, userAgent: null },
    });

    expect(result).toEqual({
      success: false,
      error: 'SIGNATURE_ALREADY_EXISTS',
    });
    expect(putMock).not.toHaveBeenCalled();
  });

  it('should return SIGNATURE_ALREADY_EXISTS and delete blob when P2002 race occurs in transaction', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    noExistingSignature();
    putMock.mockResolvedValue({ url: BLOB_URL });
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      'unique constraint failed',
      { code: 'P2002', clientVersion: '6.0.0' }
    );
    setupTransactionToInvokeCallback({ throwError: p2002 });
    delMock.mockResolvedValue(undefined);

    const result = await uploadSignatureToRegistre({
      viewer: salarieUser(),
      boutiqueId: BOUTIQUE_ID,
      dateISO: DATE_ISO,
      file: makeFile(),
      metadata: { ipAddress: null, userAgent: null },
    });

    expect(result).toEqual({
      success: false,
      error: 'SIGNATURE_ALREADY_EXISTS',
    });
    expect(delMock).toHaveBeenCalledTimes(1);
  });

  it('should return STORAGE_FAILURE and rollback blob when DB transaction throws a generic error', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    noExistingSignature();
    putMock.mockResolvedValue({ url: BLOB_URL });
    setupTransactionToInvokeCallback({ throwError: new Error('db down') });
    delMock.mockResolvedValue(undefined);

    const result = await uploadSignatureToRegistre({
      viewer: salarieUser(),
      boutiqueId: BOUTIQUE_ID,
      dateISO: DATE_ISO,
      file: makeFile(),
      metadata: { ipAddress: null, userAgent: null },
    });

    expect(result).toEqual({ success: false, error: 'STORAGE_FAILURE' });
    expect(delMock).toHaveBeenCalledTimes(1);
  });

  it('should return STORAGE_FAILURE when the blob upload itself fails', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    noExistingSignature();
    putMock.mockRejectedValue(new Error('blob unavailable'));

    const result = await uploadSignatureToRegistre({
      viewer: salarieUser(),
      boutiqueId: BOUTIQUE_ID,
      dateISO: DATE_ISO,
      file: makeFile(),
      metadata: { ipAddress: null, userAgent: null },
    });

    expect(result).toEqual({ success: false, error: 'STORAGE_FAILURE' });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('should pass an abortSignal to put() so the upload fails-fast before serverless timeout (Mp-2)', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    noExistingSignature();
    putMock.mockResolvedValue({ url: BLOB_URL });
    setupTransactionToInvokeCallback();

    await uploadSignatureToRegistre({
      viewer: salarieUser(),
      boutiqueId: BOUTIQUE_ID,
      dateISO: DATE_ISO,
      file: makeFile(),
      metadata: { ipAddress: null, userAgent: null },
    });

    expect(putMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
      expect.objectContaining({ abortSignal: expect.any(AbortSignal) })
    );
  });

  it('should upload, persist signature, log audit (no storageKey) and return id+url+signedAt on happy path', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    noExistingSignature();
    putMock.mockResolvedValue({ url: BLOB_URL });
    const createSpy = vi.fn(async () => ({
      id: SIGNATURE_ID,
      signedAt: new Date('2026-05-27T10:00:00Z'),
    }));
    vi.mocked(db.$transaction).mockImplementation(
      async <T>(arg: unknown): Promise<T> => {
        if (typeof arg === 'function') {
          const tx = {
            signature: { create: createSpy },
          };
          return arg(tx) as Promise<T>;
        }
        return Promise.resolve(arg as T);
      }
    );

    const result = await uploadSignatureToRegistre({
      viewer: salarieUser(),
      boutiqueId: BOUTIQUE_ID,
      dateISO: DATE_ISO,
      file: makeFile({ name: 'mon dossier/signature.png' }),
      metadata: { ipAddress: '1.2.3.4', userAgent: 'Mozilla/5.0' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(SIGNATURE_ID);
      expect(result.data.imageUrl).toBe(BLOB_URL);
      expect(result.data.signedAt).toEqual(new Date('2026-05-27T10:00:00Z'));
    }
    expect(putMock).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          boutiqueId: BOUTIQUE_ID,
          dateISO: DATE_ISO,
          signataireId: 'sal-1',
          signataireRoleSnapshot: 'SALARIE',
          blobUrl: BLOB_URL,
          ipAddress: '1.2.3.4',
          userAgent: 'Mozilla/5.0',
        }),
      })
    );
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SIGNATURE_CREATE',
        entityType: 'SIGNATURE',
        entityId: SIGNATURE_ID,
        performedById: 'sal-1',
        metadata: expect.not.objectContaining({
          storageKey: expect.anything(),
        }),
      })
    );
  });

  it('should run INSERT + audit in a Serializable transaction', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    noExistingSignature();
    putMock.mockResolvedValue({ url: BLOB_URL });
    setupTransactionToInvokeCallback();

    await uploadSignatureToRegistre({
      viewer: responsableUser(),
      boutiqueId: BOUTIQUE_ID,
      dateISO: DATE_ISO,
      file: makeFile(),
      metadata: { ipAddress: null, userAgent: null },
    });

    expect(db.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' })
    );
  });
});

describe('[signature.service.getSignatureForRegistre]', () => {
  it('should return BOUTIQUE_NOT_FOUND when the boutique is outside scope', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue(['b-foreign']);

    const result = await getSignatureForRegistre({
      viewer: salarieUser(),
      boutiqueId: BOUTIQUE_ID,
      dateISO: DATE_ISO,
    });

    expect(result).toEqual({ success: false, error: 'BOUTIQUE_NOT_FOUND' });
  });

  it('should return data: null when no signature exists for the day', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    vi.mocked(db.signature.findUnique).mockResolvedValue(null as never);

    const result = await getSignatureForRegistre({
      viewer: salarieUser(),
      boutiqueId: BOUTIQUE_ID,
      dateISO: DATE_ISO,
    });

    expect(result).toEqual({ success: true, data: null });
  });

  it('should return a mapped SignatureRow when found', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    vi.mocked(db.signature.findUnique).mockResolvedValue({
      id: SIGNATURE_ID,
      boutiqueId: BOUTIQUE_ID,
      dateISO: DATE_ISO,
      signataireId: 'sal-1',
      signataireRoleSnapshot: 'SALARIE',
      blobUrl: BLOB_URL,
      signedAt: new Date('2026-05-27T10:00:00Z'),
      signataire: { name: 'Lea' },
    } as never);

    const result = await getSignatureForRegistre({
      viewer: salarieUser(),
      boutiqueId: BOUTIQUE_ID,
      dateISO: DATE_ISO,
    });

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data).toMatchObject({
        id: SIGNATURE_ID,
        boutiqueId: BOUTIQUE_ID,
        dateISO: DATE_ISO,
        signataireName: 'Lea',
        imageUrl: BLOB_URL,
        signataireRoleSnapshot: 'SALARIE',
      });
    }
  });
});

describe('[signature.service.listSignaturesForBoutique]', () => {
  it('should return BOUTIQUE_NOT_FOUND when the boutique is outside scope', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue(['b-foreign']);

    const result = await listSignaturesForBoutique({
      viewer: salarieUser(),
      boutiqueId: BOUTIQUE_ID,
    });

    expect(result).toEqual({ success: false, error: 'BOUTIQUE_NOT_FOUND' });
  });

  it('should cap the limit at MAX_SIGNATURE_HISTORY (50)', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    vi.mocked(db.signature.findMany).mockResolvedValue([] as never);

    await listSignaturesForBoutique({
      viewer: salarieUser(),
      boutiqueId: BOUTIQUE_ID,
      limit: 200,
    });

    expect(db.signature.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    );
  });

  it('should map the rows into SignatureRow items', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    vi.mocked(db.signature.findMany).mockResolvedValue([
      {
        id: SIGNATURE_ID,
        boutiqueId: BOUTIQUE_ID,
        dateISO: DATE_ISO,
        signataireId: 'sal-1',
        signataireRoleSnapshot: 'SALARIE',
        blobUrl: BLOB_URL,
        signedAt: new Date('2026-05-27T10:00:00Z'),
        signataire: { name: 'Lea' },
      },
    ] as never);

    const result = await listSignaturesForBoutique({
      viewer: salarieUser(),
      boutiqueId: BOUTIQUE_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      const [first] = result.data;
      expect(first).toMatchObject({
        id: SIGNATURE_ID,
        signataireName: 'Lea',
        imageUrl: BLOB_URL,
      });
    }
  });
});
