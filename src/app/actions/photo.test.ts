import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error('NEXT_REDIRECT') as Error & { digest: string };
    error.digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw error;
  }),
}));

const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
vi.mock('@/lib/services/rateLimit', () => ({
  checkRateLimit,
  toRetryAfterSeconds: (retryAfterMs: number | undefined): number =>
    retryAfterMs ? Math.ceil(retryAfterMs / 1000) : 0,
}));

vi.mock('@/lib/services/photo.service', () => ({
  uploadPhotoToAlerte: vi.fn(),
  deletePhotoFromAlerte: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  deletePhotoFromAlerte,
  uploadPhotoToAlerte,
} from '@/lib/services/photo.service';
import { deletePhotoAction, uploadPhotoAction } from './photo';
import {
  INITIAL_PHOTO_DELETE_STATE,
  INITIAL_PHOTO_UPLOAD_STATE,
} from './photo.types';

const SALARIE_ID = 'sal-1';
const RESPONSABLE_ID = 'resp-1';
const ALERTE_ID = '11111111-1111-4111-8111-111111111111';
const PHOTO_ID = '22222222-2222-4222-8222-222222222222';

function salarieSession() {
  return {
    user: {
      id: SALARIE_ID,
      email: 'lea@maison-givre.fr',
      role: 'SALARIE',
      name: 'Lea',
    },
  } as never;
}

function responsableSession() {
  return {
    user: {
      id: RESPONSABLE_ID,
      email: 'resp@maison-givre.fr',
      role: 'RESPONSABLE',
      name: 'Resp',
    },
  } as never;
}

function makeFile(size = 200_000, type = 'image/jpeg', name = 'a.jpg'): File {
  // Vrai `File` natif (Node 18+) pour que `value instanceof File` soit
  // bien valide cote Server Action. Le contenu est synthetise pour
  // matcher la taille attendue.
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

function makeFormData(values: Record<string, string | File | undefined>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      continue;
    }
    if (value instanceof File) {
      fd.set(key, value);
    } else {
      fd.set(key, value);
    }
  }
  return fd;
}

function rateOk() {
  return {
    allowed: true,
    remainingRequests: 19,
    resetAtMs: Date.now() + 60_000,
  };
}
function rateBlocked() {
  return {
    allowed: false,
    remainingRequests: 0,
    resetAtMs: Date.now() + 60_000,
    retryAfterMs: 30_000,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue(rateOk());
});

describe('[uploadPhotoAction]', () => {
  it('should redirect to /login when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    await expect(
      uploadPhotoAction(
        INITIAL_PHOTO_UPLOAD_STATE,
        makeFormData({ alerteId: ALERTE_ID, file: makeFile() })
      )
    ).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
    });
    expect(redirect).toHaveBeenCalledWith('/login');
    expect(uploadPhotoToAlerte).not.toHaveBeenCalled();
  });

  it('should return FORBIDDEN when the viewer is a SALARIE (US-PHO-001 H-3 alignment)', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());

    const result = await uploadPhotoAction(
      INITIAL_PHOTO_UPLOAD_STATE,
      makeFormData({ alerteId: ALERTE_ID, file: makeFile() })
    );

    expect(result).toEqual({ status: 'error', code: 'FORBIDDEN' });
    expect(uploadPhotoToAlerte).not.toHaveBeenCalled();
  });

  it('should return RATE_LIMITED when limiter blocks the request', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    checkRateLimit.mockResolvedValue(rateBlocked());

    const result = await uploadPhotoAction(
      INITIAL_PHOTO_UPLOAD_STATE,
      makeFormData({ alerteId: ALERTE_ID, file: makeFile() })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('RATE_LIMITED');
      expect(result.retryAfterSeconds).toBe(30);
    }
    expect(checkRateLimit).toHaveBeenCalledWith(
      'PHOTO_UPLOAD',
      `user:${RESPONSABLE_ID}`
    );
  });

  it('should return VALIDATION when alerteId is not a UUID', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());

    const result = await uploadPhotoAction(
      INITIAL_PHOTO_UPLOAD_STATE,
      makeFormData({ alerteId: 'not-uuid', file: makeFile() })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.alerteId).toBeDefined();
    }
  });

  it('should return INVALID_FILE when no file is provided', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());

    const result = await uploadPhotoAction(
      INITIAL_PHOTO_UPLOAD_STATE,
      makeFormData({ alerteId: ALERTE_ID })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('INVALID_FILE');
    }
  });

  it('should map TOO_LARGE service error to TOO_LARGE action code', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(uploadPhotoToAlerte).mockResolvedValue({
      success: false,
      error: 'TOO_LARGE',
    });

    const result = await uploadPhotoAction(
      INITIAL_PHOTO_UPLOAD_STATE,
      makeFormData({ alerteId: ALERTE_ID, file: makeFile() })
    );

    expect(result).toEqual({ status: 'error', code: 'TOO_LARGE' });
  });

  it('should map ALERTE_NOT_FOUND service error to ALERTE_NOT_FOUND action code', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(uploadPhotoToAlerte).mockResolvedValue({
      success: false,
      error: 'ALERTE_NOT_FOUND',
    });

    const result = await uploadPhotoAction(
      INITIAL_PHOTO_UPLOAD_STATE,
      makeFormData({ alerteId: ALERTE_ID, file: makeFile() })
    );

    expect(result).toEqual({ status: 'error', code: 'ALERTE_NOT_FOUND' });
  });

  it('should map QUOTA_EXCEEDED service error to QUOTA_EXCEEDED action code', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(uploadPhotoToAlerte).mockResolvedValue({
      success: false,
      error: 'QUOTA_EXCEEDED',
    });

    const result = await uploadPhotoAction(
      INITIAL_PHOTO_UPLOAD_STATE,
      makeFormData({ alerteId: ALERTE_ID, file: makeFile() })
    );

    expect(result).toEqual({ status: 'error', code: 'QUOTA_EXCEEDED' });
  });

  it('should map STORAGE_FAILURE service error to STORAGE_FAILURE action code', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(uploadPhotoToAlerte).mockResolvedValue({
      success: false,
      error: 'STORAGE_FAILURE',
    });

    const result = await uploadPhotoAction(
      INITIAL_PHOTO_UPLOAD_STATE,
      makeFormData({ alerteId: ALERTE_ID, file: makeFile() })
    );

    expect(result).toEqual({ status: 'error', code: 'STORAGE_FAILURE' });
  });

  it('should map INVALID_MIME service error to INVALID_MIME action code', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(uploadPhotoToAlerte).mockResolvedValue({
      success: false,
      error: 'INVALID_MIME',
    });

    const result = await uploadPhotoAction(
      INITIAL_PHOTO_UPLOAD_STATE,
      makeFormData({ alerteId: ALERTE_ID, file: makeFile() })
    );

    expect(result).toEqual({ status: 'error', code: 'INVALID_MIME' });
  });

  it('should call the service, revalidate and return success with photoId+signedUrl', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(uploadPhotoToAlerte).mockResolvedValue({
      success: true,
      data: { id: PHOTO_ID, signedUrl: 'https://blob/x.jpg' },
    });

    const result = await uploadPhotoAction(
      INITIAL_PHOTO_UPLOAD_STATE,
      makeFormData({ alerteId: ALERTE_ID, file: makeFile() })
    );

    expect(uploadPhotoToAlerte).toHaveBeenCalledWith(
      expect.objectContaining({
        viewer: { id: RESPONSABLE_ID, role: 'RESPONSABLE' },
        alerteId: ALERTE_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(`/alertes/${ALERTE_ID}`);
    expect(result).toEqual({
      status: 'success',
      photoId: PHOTO_ID,
      signedUrl: 'https://blob/x.jpg',
    });
  });
});

describe('[deletePhotoAction]', () => {
  it('should redirect to /login when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    await expect(
      deletePhotoAction(
        INITIAL_PHOTO_DELETE_STATE,
        makeFormData({ photoId: PHOTO_ID, alerteId: ALERTE_ID })
      )
    ).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
    });
    expect(deletePhotoFromAlerte).not.toHaveBeenCalled();
  });

  it('should return FORBIDDEN when the user role is SALARIE', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());

    const result = await deletePhotoAction(
      INITIAL_PHOTO_DELETE_STATE,
      makeFormData({ photoId: PHOTO_ID, alerteId: ALERTE_ID })
    );

    expect(result).toEqual({ status: 'error', code: 'FORBIDDEN' });
    expect(deletePhotoFromAlerte).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when photoId is missing', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());

    const result = await deletePhotoAction(
      INITIAL_PHOTO_DELETE_STATE,
      makeFormData({ alerteId: ALERTE_ID })
    );

    expect(result).toEqual({ status: 'error', code: 'VALIDATION' });
  });

  it('should map ALERTE_NOT_FOUND service error to ALERTE_NOT_FOUND action code', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(deletePhotoFromAlerte).mockResolvedValue({
      success: false,
      error: 'ALERTE_NOT_FOUND',
    });

    const result = await deletePhotoAction(
      INITIAL_PHOTO_DELETE_STATE,
      makeFormData({ photoId: PHOTO_ID, alerteId: ALERTE_ID })
    );

    expect(result).toEqual({ status: 'error', code: 'ALERTE_NOT_FOUND' });
  });

  it('should map unknown service error to INTERNAL', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(deletePhotoFromAlerte).mockResolvedValue({
      success: false,
      error: 'STORAGE_FAILURE',
    });

    const result = await deletePhotoAction(
      INITIAL_PHOTO_DELETE_STATE,
      makeFormData({ photoId: PHOTO_ID, alerteId: ALERTE_ID })
    );

    expect(result).toEqual({ status: 'error', code: 'INTERNAL' });
  });

  it('should call the service, revalidate and return success', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(deletePhotoFromAlerte).mockResolvedValue({
      success: true,
      data: { id: PHOTO_ID },
    });

    const result = await deletePhotoAction(
      INITIAL_PHOTO_DELETE_STATE,
      makeFormData({ photoId: PHOTO_ID, alerteId: ALERTE_ID })
    );

    expect(deletePhotoFromAlerte).toHaveBeenCalledWith({
      viewer: { id: RESPONSABLE_ID, role: 'RESPONSABLE' },
      photoId: PHOTO_ID,
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/alertes/${ALERTE_ID}`);
    expect(result).toEqual({ status: 'success' });
  });
});
