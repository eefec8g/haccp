import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '@/lib/constants/auth';

/**
 * Hash un mot de passe en clair via bcrypt (BCRYPT_ROUNDS).
 * Ne JAMAIS logger l'argument `plain`.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Compare un password en clair a un hash bcrypt en temps constant.
 * `bcrypt.compare` est resistant aux timing attacks de longueur.
 * Retourne false si `hash` est vide/malforme (au lieu de throw).
 */
export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  if (!hash) {
    return false;
  }
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
