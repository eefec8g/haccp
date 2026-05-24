import { createHash, randomBytes } from 'crypto';
import { RESET_TOKEN_BYTES } from '@/lib/constants/auth';

export interface ResetTokenPair {
  /** Token en clair a envoyer dans l'URL email (jamais persiste). */
  readonly plain: string;
  /** Hash SHA256 du token en clair, stocke en DB pour lookup. */
  readonly hash: string;
}

/**
 * Genere un token reset de RESET_TOKEN_BYTES octets aleatoires
 * encode en base64url + son hash SHA256.
 *
 * On stocke uniquement le hash en DB : meme un dump SQL ne permet
 * pas de forger un reset link valide (preimage SHA256 infaisable).
 */
export function generateResetToken(): ResetTokenPair {
  const plain = randomBytes(RESET_TOKEN_BYTES).toString('base64url');
  return { plain, hash: hashToken(plain) };
}

/**
 * Hash SHA256 hex d'un token en clair. Sert au lookup DB.
 * Pas besoin de salt : le token lui-meme a 256 bits d'entropie.
 */
export function hashToken(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}
