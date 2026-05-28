import type { User } from '@prisma/client';
import { db } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/utils/password';
import { generateResetToken, hashToken } from '@/lib/utils/tokens';
import { RESET_TOKEN_EXPIRY_MS } from '@/lib/constants/auth';
import type { AuthUser } from '@/types/auth';

/**
 * Hash bcrypt valide utilise pour le verify "dummy" anti-timing /
 * anti-enumeration. Genere via bcrypt rounds=12 sur la chaine
 * "__dummy_password__". Le contenu derriere est non-significatif,
 * seule la forme (60 chars, schema $2a$12$...) compte.
 */
const DUMMY_BCRYPT_HASH =
  '$2a$12$CwTycUXWue0Thq9StjUM0uJ8.RW1uW.0V5SXEm6Y2fX7GZv4n2eYO';

export type AuthError =
  | 'INVALID_CREDENTIALS'
  | 'INACTIVE_ACCOUNT'
  | 'INVALID_TOKEN'
  | 'EXPIRED_TOKEN'
  | 'TOKEN_ALREADY_USED'
  | 'INTERNAL_ERROR';

/**
 * Erreurs du changement de mot de passe par l'utilisateur connecte.
 *
 * - `USER_NOT_FOUND` : compte introuvable ou desactive entre la creation
 *   de session et la requete (defense en profondeur).
 * - `INVALID_CURRENT_PASSWORD` : le mot de passe actuel est faux
 *   (anti-hijack : on exige la preuve de connaissance du secret courant).
 * - `SAME_PASSWORD` : le nouveau mot de passe est identique a l'actuel.
 * - `INTERNAL` : echec inattendu (DB).
 */
export type ChangePasswordError =
  | 'USER_NOT_FOUND'
  | 'INVALID_CURRENT_PASSWORD'
  | 'SAME_PASSWORD'
  | 'INTERNAL';

interface ChangePasswordInput {
  readonly userId: string;
  readonly currentPassword: string;
  readonly newPassword: string;
}

export type Result<T, E = AuthError> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

interface AuthenticatedUser {
  readonly user: AuthUser;
}

interface ResetTokenIssued {
  /** Token en clair a injecter dans l'URL email. Vide si user inconnu. */
  readonly plainToken: string | null;
  /** Date d'expiration (utile pour l'email). Null si user inconnu. */
  readonly expiresAt: Date | null;
}

interface ValidatedToken {
  readonly userId: string;
  readonly email: string;
}

/**
 * Calcule la liste des boutiques accessibles a un user sans depasser
 * la SRP de auth.service : on delegue a `permissions.ts` plus tard
 * si necessaire. Pour la session JWT, on n'a besoin que d'un snapshot
 * stable a la connexion. Pour SALARIE c'est trivial (boutiqueSalarieId).
 *
 * Pour RESPONSABLE on lit BoutiqueUser. Pour ADMIN on stocke un
 * tableau vide : `getAccessibleBoutiqueIds` (permissions.ts) resoudra
 * a la liste complete (toutes les boutiques actives) cote service.
 */
async function computeBoutiqueIdsForSession(
  user: Pick<User, 'id' | 'role' | 'boutiqueSalarieId'>
): Promise<readonly string[]> {
  if (user.role === 'ADMIN') {
    return [];
  }
  if (user.role === 'SALARIE') {
    return user.boutiqueSalarieId ? [user.boutiqueSalarieId] : [];
  }
  const rows = await db.boutiqueUser.findMany({
    where: { userId: user.id },
    select: { boutiqueId: true },
  });
  return rows.map((r) => r.boutiqueId);
}

/**
 * Authentifie un user par email + password.
 *
 * Mesures anti-enum :
 *   - meme si l'email n'existe pas, on lance `verifyPassword` sur
 *     un hash dummy pour garantir un temps de reponse constant.
 *   - retourne toujours `INVALID_CREDENTIALS` (jamais `USER_NOT_FOUND`).
 *
 * Compte inactif : on retourne `INACTIVE_ACCOUNT` (non confidentiel,
 * un admin a deja fait le tri).
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<Result<AuthenticatedUser>> {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  const hashToCheck = user?.password ?? DUMMY_BCRYPT_HASH;
  const passwordOk = await verifyPassword(password, hashToCheck);

  if (!user || !passwordOk) {
    return { success: false, error: 'INVALID_CREDENTIALS' };
  }
  if (!user.actif) {
    return { success: false, error: 'INACTIVE_ACCOUNT' };
  }

  const boutiqueIds = await computeBoutiqueIdsForSession(user);
  return {
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        boutiqueIds,
        actif: user.actif,
      },
    },
  };
}

/**
 * Genere et persiste un token de reinitialisation pour `email`.
 *
 * Anti-enumeration : si l'email est inconnu, on retourne success
 * silencieusement avec `plainToken: null`. Le caller ne doit PAS
 * differencier les deux cas dans la reponse HTTP.
 *
 * Invalide les anciens tokens non-utilises (single active token).
 */
export async function generatePasswordResetToken(
  email: string
): Promise<Result<ResetTokenIssued>> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, actif: true, email: true },
  });

  if (!user || !user.actif) {
    return { success: true, data: { plainToken: null, expiresAt: null } };
  }

  const { plain, hash } = generateResetToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  await db.$transaction([
    db.passwordResetToken.updateMany({
      where: { email: user.email, usedAt: null },
      data: { usedAt: new Date() },
    }),
    db.passwordResetToken.create({
      data: { email: user.email, token: hash, expiresAt },
    }),
  ]);

  return { success: true, data: { plainToken: plain, expiresAt } };
}

/**
 * Verifie qu'un token reset est valide : existe, non expire, non utilise.
 * Retourne l'email + userId associes pour le flow de reset.
 */
export async function validateResetToken(
  plainToken: string
): Promise<Result<ValidatedToken>> {
  if (!plainToken || plainToken.length < 32) {
    return { success: false, error: 'INVALID_TOKEN' };
  }

  const tokenHash = hashToken(plainToken);
  const record = await db.passwordResetToken.findUnique({
    where: { token: tokenHash },
  });

  if (!record) {
    return { success: false, error: 'INVALID_TOKEN' };
  }
  if (record.usedAt !== null) {
    return { success: false, error: 'TOKEN_ALREADY_USED' };
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    return { success: false, error: 'EXPIRED_TOKEN' };
  }

  const user = await db.user.findUnique({
    where: { email: record.email },
    select: { id: true, email: true, actif: true },
  });
  if (!user || !user.actif) {
    return { success: false, error: 'INVALID_TOKEN' };
  }

  return { success: true, data: { userId: user.id, email: user.email } };
}

/**
 * Reset effectif du mot de passe. Atomique :
 *   1. Marque le token comme utilise (usedAt = now).
 *   2. Update le password hash de l'utilisateur.
 *
 * Re-valide le token DANS la transaction pour eviter une race
 * (double consommation entre validateResetToken et resetPassword).
 */
export async function resetPassword(
  plainToken: string,
  newPassword: string
): Promise<Result<{ readonly userId: string }>> {
  const validation = await validateResetToken(plainToken);
  if (!validation.success) {
    return validation;
  }

  const tokenHash = hashToken(plainToken);
  const newPasswordHash = await hashPassword(newPassword);
  const now = new Date();

  try {
    await db.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: { token: tokenHash, usedAt: null },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) {
        // Race : un autre process a consomme le token entre-temps.
        throw new Error('TOKEN_ALREADY_USED');
      }
      await tx.user.update({
        where: { email: validation.data.email },
        data: { password: newPasswordHash },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'TOKEN_ALREADY_USED') {
      return { success: false, error: 'TOKEN_ALREADY_USED' };
    }
    return { success: false, error: 'INTERNAL_ERROR' };
  }

  return { success: true, data: { userId: validation.data.userId } };
}

/**
 * Change le mot de passe d'un utilisateur connecte.
 *
 * Securite :
 *   - `userId` provient de la session serveur (jamais du formulaire) :
 *     un user ne peut changer QUE son propre mot de passe.
 *   - Verification OBLIGATOIRE du mot de passe ACTUEL : anti-hijack si
 *     une session est volee, l'attaquant ne connait pas le secret courant.
 *   - Refuse un compte introuvable ou inactif (`USER_NOT_FOUND`).
 *   - Refuse un nouveau mot de passe identique a l'actuel (`SAME_PASSWORD`).
 *   - Le nouveau hash bcrypt (12 rounds) remplace l'ancien.
 *
 * La force du nouveau mot de passe est validee EN AMONT (Zod), pas ici :
 * le service suppose un `newPassword` deja conforme aux regles de complexite.
 */
export async function changePassword({
  userId,
  currentPassword,
  newPassword,
}: ChangePasswordInput): Promise<Result<void, ChangePasswordError>> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true, actif: true },
  });

  if (!user || !user.actif) {
    return { success: false, error: 'USER_NOT_FOUND' };
  }

  const currentOk = await verifyPassword(currentPassword, user.password);
  if (!currentOk) {
    return { success: false, error: 'INVALID_CURRENT_PASSWORD' };
  }

  if (currentPassword === newPassword) {
    return { success: false, error: 'SAME_PASSWORD' };
  }

  try {
    const newPasswordHash = await hashPassword(newPassword);
    await db.user.update({
      where: { id: user.id },
      data: { password: newPasswordHash },
    });
  } catch {
    return { success: false, error: 'INTERNAL' };
  }

  return { success: true, data: undefined };
}
