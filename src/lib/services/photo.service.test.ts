import { beforeEach, describe, expect, it, vi } from 'vitest';

const { putMock, delMock } = vi.hoisted(() => ({
  putMock: vi.fn(),
  delMock: vi.fn(),
}));

vi.mock('@vercel/blob', () => ({
  put: putMock,
  del: delMock,
}));

vi.mock('@/lib/prisma', () => {
  const photo = {
    count: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  };
  const alerte = {
    findUnique: vi.fn(),
  };
  return {
    db: {
      photo,
      alerte,
      $transaction: vi.fn(),
    },
  };
});

vi.mock('@/lib/permissions', () => ({
  canManageAlertes: vi.fn(),
  getAccessibleBoutiqueIds: vi.fn(),
}));

vi.mock('@/lib/services/alerte.service', () => ({
  getAlerteById: vi.fn(),
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
import {
  canManageAlertes,
  getAccessibleBoutiqueIds,
  type SessionUser,
} from '@/lib/permissions';
import { getAlerteById } from '@/lib/services/alerte.service';
import { logAudit } from '@/lib/services/audit-log.service';
import { logger } from '@/lib/logger';
import {
  deletePhotoFromAlerte,
  listPhotosForAlerte,
  uploadPhotoToAlerte,
} from './photo.service';

const ALERTE_ID = '11111111-1111-4111-8111-111111111111';
const PHOTO_ID = '22222222-2222-4222-8222-222222222222';
const BOUTIQUE_ID = 'b-1';

function salarieUser(): SessionUser {
  return { id: 'sal-1', role: 'SALARIE' };
}
function responsableUser(): SessionUser {
  return { id: 'resp-1', role: 'RESPONSABLE' };
}

// Signatures binaires reelles pour produire des buffers `arrayBuffer()`
// valides cote service (magic bytes check, US-PHO-001 H-1).
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]); // "%PDF-1"

function makeFile({
  size = 1024,
  type = 'image/jpeg',
  name = 'photo.jpg',
  bytes = JPEG_BYTES,
}: {
  size?: number;
  type?: string;
  name?: string;
  bytes?: Uint8Array;
} = {}): File {
  // On simule un File sans construire un vrai Blob (mocks Vercel Blob).
  // arrayBuffer() retourne les magic bytes appropries pour passer
  // verifyImageMagicBytes (sauf cas de spoofing explicite).
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

function setupHappyAlerteScope(): void {
  vi.mocked(db.alerte.findUnique).mockResolvedValue({
    releve: { boutiqueId: BOUTIQUE_ID },
  } as never);
  vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
}

interface TxOptions {
  readonly count?: number;
  readonly createdId?: string;
  readonly throwOnCreate?: boolean;
}

/**
 * Configure `db.$transaction` pour invoquer la callback avec un tx mock
 * dont `photo.count` et `photo.create` sont parameterisables. Permet de
 * simuler la race condition (count>=MAX au moment du SELECT FOR UPDATE).
 */
function setupTransactionToInvokeCallback(options: TxOptions = {}): void {
  const { count = 0, createdId = PHOTO_ID, throwOnCreate = false } = options;
  vi.mocked(db.$transaction).mockImplementation(
    async <T>(arg: unknown, _opts?: unknown): Promise<T> => {
      if (typeof arg === 'function') {
        const tx = {
          photo: {
            count: vi.fn(async () => count),
            create: vi.fn(async () => {
              if (throwOnCreate) {
                throw new Error('insert failed');
              }
              return { id: createdId };
            }),
            delete: vi.fn(async () => undefined),
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

describe('[photo.service.uploadPhotoToAlerte]', () => {
  it('should return ALERTE_NOT_FOUND when the alerte does not exist', async () => {
    vi.mocked(db.alerte.findUnique).mockResolvedValue(null as never);

    const result = await uploadPhotoToAlerte({
      viewer: salarieUser(),
      alerteId: ALERTE_ID,
      file: makeFile(),
    });

    expect(result).toEqual({ success: false, error: 'ALERTE_NOT_FOUND' });
    expect(putMock).not.toHaveBeenCalled();
  });

  it('should return ALERTE_NOT_FOUND when the alerte is outside the viewer scope', async () => {
    vi.mocked(db.alerte.findUnique).mockResolvedValue({
      releve: { boutiqueId: 'b-foreign' },
    } as never);
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);

    const result = await uploadPhotoToAlerte({
      viewer: salarieUser(),
      alerteId: ALERTE_ID,
      file: makeFile(),
    });

    expect(result).toEqual({ success: false, error: 'ALERTE_NOT_FOUND' });
    expect(putMock).not.toHaveBeenCalled();
  });

  it('should return TOO_LARGE when the file exceeds MAX_PHOTO_SIZE_BYTES', async () => {
    setupHappyAlerteScope();

    const result = await uploadPhotoToAlerte({
      viewer: salarieUser(),
      alerteId: ALERTE_ID,
      file: makeFile({ size: 3 * 1024 * 1024 }),
    });

    expect(result).toEqual({ success: false, error: 'TOO_LARGE' });
    expect(putMock).not.toHaveBeenCalled();
  });

  it('should return INVALID_MIME when the declared file type is not whitelisted', async () => {
    setupHappyAlerteScope();

    const result = await uploadPhotoToAlerte({
      viewer: salarieUser(),
      alerteId: ALERTE_ID,
      file: makeFile({ type: 'image/gif' }),
    });

    expect(result).toEqual({ success: false, error: 'INVALID_MIME' });
    expect(putMock).not.toHaveBeenCalled();
  });

  it('should return INVALID_MIME when magic bytes do not match the declared MIME (MIME spoofing)', async () => {
    setupHappyAlerteScope();

    // Declared image/jpeg but real content is a PDF -> spoofing detected.
    const result = await uploadPhotoToAlerte({
      viewer: salarieUser(),
      alerteId: ALERTE_ID,
      file: makeFile({ type: 'image/jpeg', bytes: PDF_BYTES }),
    });

    expect(result).toEqual({ success: false, error: 'INVALID_MIME' });
    expect(putMock).not.toHaveBeenCalled();
  });

  it('should return INVALID_MIME when magic bytes say PNG but declared MIME is JPEG', async () => {
    setupHappyAlerteScope();

    const result = await uploadPhotoToAlerte({
      viewer: salarieUser(),
      alerteId: ALERTE_ID,
      file: makeFile({ type: 'image/jpeg', bytes: PNG_BYTES }),
    });

    expect(result).toEqual({ success: false, error: 'INVALID_MIME' });
    expect(putMock).not.toHaveBeenCalled();
  });

  it('should return QUOTA_EXCEEDED when the transaction sees count>=MAX (race condition safe)', async () => {
    setupHappyAlerteScope();
    putMock.mockResolvedValue({ url: 'https://blob.example/photos/k.jpg' });
    setupTransactionToInvokeCallback({ count: 3 });
    delMock.mockResolvedValue(undefined);

    const result = await uploadPhotoToAlerte({
      viewer: salarieUser(),
      alerteId: ALERTE_ID,
      file: makeFile(),
    });

    expect(result).toEqual({ success: false, error: 'QUOTA_EXCEEDED' });
    // Compensation : le blob a ete supprime apres l'echec quota.
    expect(delMock).toHaveBeenCalledTimes(1);
  });

  it('should run quota check + INSERT in a Serializable transaction', async () => {
    setupHappyAlerteScope();
    putMock.mockResolvedValue({ url: 'https://blob.example/photos/k.jpg' });
    setupTransactionToInvokeCallback({ count: 0 });

    await uploadPhotoToAlerte({
      viewer: salarieUser(),
      alerteId: ALERTE_ID,
      file: makeFile(),
    });

    expect(db.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' })
    );
  });

  it('should upload, persist Photo with blobUrl, log audit (no storageKey) and return id+url', async () => {
    setupHappyAlerteScope();
    putMock.mockResolvedValue({ url: 'https://blob.example/photos/k.jpg' });
    // On capture les args passes a tx.photo.create pour valider blobUrl.
    const createSpy = vi.fn(async () => ({ id: PHOTO_ID }));
    vi.mocked(db.$transaction).mockImplementation(
      async <T>(arg: unknown): Promise<T> => {
        if (typeof arg === 'function') {
          const tx = {
            photo: {
              count: vi.fn(async () => 0),
              create: createSpy,
            },
          };
          return arg(tx) as Promise<T>;
        }
        return Promise.resolve(arg as T);
      }
    );

    const result = await uploadPhotoToAlerte({
      viewer: salarieUser(),
      alerteId: ALERTE_ID,
      file: makeFile({ size: 200_000, type: 'image/jpeg', name: 'a.jpg' }),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(PHOTO_ID);
      expect(result.data.signedUrl).toBe('https://blob.example/photos/k.jpg');
    }
    expect(putMock).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          blobUrl: 'https://blob.example/photos/k.jpg',
        }),
      })
    );
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PHOTO_UPLOAD',
        entityType: 'PHOTO',
        entityId: PHOTO_ID,
        performedById: 'sal-1',
        metadata: expect.not.objectContaining({
          storageKey: expect.anything(),
        }),
      })
    );
  });

  it('should return STORAGE_FAILURE and rollback the blob when DB transaction throws', async () => {
    setupHappyAlerteScope();
    putMock.mockResolvedValue({ url: 'https://blob.example/photos/k.jpg' });
    vi.mocked(db.$transaction).mockRejectedValue(new Error('db down'));
    delMock.mockResolvedValue(undefined);

    const result = await uploadPhotoToAlerte({
      viewer: salarieUser(),
      alerteId: ALERTE_ID,
      file: makeFile(),
    });

    expect(result).toEqual({ success: false, error: 'STORAGE_FAILURE' });
    expect(delMock).toHaveBeenCalledTimes(1);
  });

  it('should return STORAGE_FAILURE when the blob upload itself fails', async () => {
    setupHappyAlerteScope();
    putMock.mockRejectedValue(new Error('blob unavailable'));

    const result = await uploadPhotoToAlerte({
      viewer: salarieUser(),
      alerteId: ALERTE_ID,
      file: makeFile(),
    });

    expect(result).toEqual({ success: false, error: 'STORAGE_FAILURE' });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe('[photo.service.deletePhotoFromAlerte]', () => {
  it('should return FORBIDDEN when the viewer is a SALARIE', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(false);

    const result = await deletePhotoFromAlerte({
      viewer: salarieUser(),
      photoId: PHOTO_ID,
    });

    expect(result).toEqual({ success: false, error: 'FORBIDDEN' });
    expect(db.photo.findUnique).not.toHaveBeenCalled();
  });

  it('should return ALERTE_NOT_FOUND when the photo does not exist', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(true);
    vi.mocked(db.photo.findUnique).mockResolvedValue(null as never);

    const result = await deletePhotoFromAlerte({
      viewer: responsableUser(),
      photoId: PHOTO_ID,
    });

    expect(result).toEqual({ success: false, error: 'ALERTE_NOT_FOUND' });
  });

  it('should return ALERTE_NOT_FOUND when the photo boutique is outside scope', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(true);
    vi.mocked(db.photo.findUnique).mockResolvedValue({
      id: PHOTO_ID,
      storageKey: 'photos/x/k.jpg',
      alerteId: ALERTE_ID,
      filename: 'a.jpg',
      alerte: { releve: { boutiqueId: 'b-foreign' } },
    } as never);
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);

    const result = await deletePhotoFromAlerte({
      viewer: responsableUser(),
      photoId: PHOTO_ID,
    });

    expect(result).toEqual({ success: false, error: 'ALERTE_NOT_FOUND' });
  });

  it('should delete, audit (without storageKey) and remove the blob on happy path', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(true);
    vi.mocked(db.photo.findUnique).mockResolvedValue({
      id: PHOTO_ID,
      storageKey: 'photos/x/k.jpg',
      alerteId: ALERTE_ID,
      filename: 'a.jpg',
      alerte: { releve: { boutiqueId: BOUTIQUE_ID } },
    } as never);
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    setupTransactionToInvokeCallback();
    delMock.mockResolvedValue(undefined);

    const result = await deletePhotoFromAlerte({
      viewer: responsableUser(),
      photoId: PHOTO_ID,
    });

    expect(result).toEqual({ success: true, data: { id: PHOTO_ID } });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PHOTO_DELETE',
        entityType: 'PHOTO',
        entityId: PHOTO_ID,
        performedById: 'resp-1',
        metadata: expect.not.objectContaining({
          storageKey: expect.anything(),
        }),
      })
    );
    expect(delMock).toHaveBeenCalledWith('photos/x/k.jpg');
  });

  it('should return INTERNAL when the DB transaction fails (blob NOT deleted)', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(true);
    vi.mocked(db.photo.findUnique).mockResolvedValue({
      id: PHOTO_ID,
      storageKey: 'photos/x/k.jpg',
      alerteId: ALERTE_ID,
      filename: 'a.jpg',
      alerte: { releve: { boutiqueId: BOUTIQUE_ID } },
    } as never);
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    vi.mocked(db.$transaction).mockRejectedValue(new Error('db down'));

    const result = await deletePhotoFromAlerte({
      viewer: responsableUser(),
      photoId: PHOTO_ID,
    });

    expect(result).toEqual({ success: false, error: 'INTERNAL' });
    expect(delMock).not.toHaveBeenCalled();
  });
});

describe('[photo.service.listPhotosForAlerte]', () => {
  it('should reuse getAlerteById for RESPONSABLE and return mapped photos with blobUrl as signedUrl', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(true);
    vi.mocked(getAlerteById).mockResolvedValue({
      success: true,
      data: { id: ALERTE_ID } as never,
    });
    vi.mocked(db.photo.findMany).mockResolvedValue([
      {
        id: PHOTO_ID,
        alerteId: ALERTE_ID,
        mimeType: 'image/jpeg',
        sizeBytes: 200_000,
        filename: 'a.jpg',
        blobUrl: 'https://blob.example/photos/x/k.jpg',
        createdAt: new Date('2026-05-27T10:00:00Z'),
        uploadedByUserId: 'sal-1',
        uploadedBy: { name: 'Lea' },
      },
    ] as never);

    const result = await listPhotosForAlerte({
      viewer: responsableUser(),
      alerteId: ALERTE_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: PHOTO_ID,
        mimeType: 'image/jpeg',
        uploadedByName: 'Lea',
        signedUrl: 'https://blob.example/photos/x/k.jpg',
      });
    }
    expect(getAlerteById).toHaveBeenCalledWith({
      viewer: { id: 'resp-1', role: 'RESPONSABLE' },
      alerteId: ALERTE_ID,
    });
  });

  it('should bypass getAlerteById for SALARIE and use scope helper directly', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(false);
    setupHappyAlerteScope();
    vi.mocked(db.photo.findMany).mockResolvedValue([] as never);

    const result = await listPhotosForAlerte({
      viewer: salarieUser(),
      alerteId: ALERTE_ID,
    });

    expect(result.success).toBe(true);
    expect(getAlerteById).not.toHaveBeenCalled();
  });

  it('should return ALERTE_NOT_FOUND for SALARIE when scope check fails', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(false);
    vi.mocked(db.alerte.findUnique).mockResolvedValue(null as never);

    const result = await listPhotosForAlerte({
      viewer: salarieUser(),
      alerteId: ALERTE_ID,
    });

    expect(result).toEqual({ success: false, error: 'ALERTE_NOT_FOUND' });
  });

  it('should map FORBIDDEN from getAlerteById to FORBIDDEN', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(true);
    vi.mocked(getAlerteById).mockResolvedValue({
      success: false,
      error: 'FORBIDDEN',
    });

    const result = await listPhotosForAlerte({
      viewer: responsableUser(),
      alerteId: ALERTE_ID,
    });

    expect(result).toEqual({ success: false, error: 'FORBIDDEN' });
  });

  it('should map NOT_FOUND from getAlerteById to ALERTE_NOT_FOUND', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(true);
    vi.mocked(getAlerteById).mockResolvedValue({
      success: false,
      error: 'NOT_FOUND',
    });

    const result = await listPhotosForAlerte({
      viewer: responsableUser(),
      alerteId: ALERTE_ID,
    });

    expect(result).toEqual({ success: false, error: 'ALERTE_NOT_FOUND' });
  });

  it('should warn and filter out rows with an unexpected mimeType in DB (defensif)', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(true);
    vi.mocked(getAlerteById).mockResolvedValue({
      success: true,
      data: { id: ALERTE_ID } as never,
    });
    vi.mocked(db.photo.findMany).mockResolvedValue([
      {
        id: 'p-good',
        alerteId: ALERTE_ID,
        mimeType: 'image/png',
        sizeBytes: 1000,
        filename: 'ok.png',
        blobUrl: 'https://blob.example/ok.png',
        createdAt: new Date('2026-05-27T10:00:00Z'),
        uploadedByUserId: 'sal-1',
        uploadedBy: { name: 'Lea' },
      },
      {
        id: 'p-bad',
        alerteId: ALERTE_ID,
        mimeType: 'image/tiff', // hors whitelist
        sizeBytes: 1000,
        filename: 'bad.tiff',
        blobUrl: 'https://blob.example/bad.tiff',
        createdAt: new Date('2026-05-27T10:01:00Z'),
        uploadedByUserId: 'sal-1',
        uploadedBy: { name: 'Lea' },
      },
    ] as never);

    const result = await listPhotosForAlerte({
      viewer: responsableUser(),
      alerteId: ALERTE_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      const [first] = result.data;
      expect(first?.id).toBe('p-good');
    }
    expect(logger.warn).toHaveBeenCalledWith(
      '[photo.service] unexpected mime in DB',
      expect.objectContaining({ photoId: 'p-bad', mimeType: 'image/tiff' })
    );
  });
});
