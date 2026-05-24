import { createHash } from 'crypto';

export interface SignaturePayload {
  userId: string;
  serverTimestamp: Date;
  ip: string | null;
  equipementId: string;
  creneau: string;
  temperature: number;
  commentaire: string | null;
}

/**
 * Calcule une signature numerique simple (eIDAS) pour un releve.
 * sha256(userId || timestamp || ip || equipementId || creneau || temperature || commentaire)
 * Sert de preuve d'integrite et d'identification (signature legere).
 */
export function computeReleveSignature(payload: SignaturePayload): string {
  const parts = [
    payload.userId,
    payload.serverTimestamp.toISOString(),
    payload.ip ?? 'unknown',
    payload.equipementId,
    payload.creneau,
    payload.temperature.toString(),
    payload.commentaire ?? '',
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export function verifyReleveSignature(
  payload: SignaturePayload,
  signature: string
): boolean {
  return computeReleveSignature(payload) === signature;
}
