import { Prisma, type User, type UserRole } from '@prisma/client';
import { db } from '@/lib/prisma';
import type {
  InvitationPayload,
  PaginatedResult,
  PaginationQuery,
  UserListItem,
} from '@/types/admin';
import type { Result } from '@/types/result';
import type { UserInviteInput } from '@/lib/validations/admin';
import { generateResetToken, hashToken } from '@/lib/utils/tokens';
import { hashPassword } from '@/lib/utils/password';
import { INVITATION_TOKEN_EXPIRY_MS } from '@/lib/constants/admin';
import { logAudit } from '@/lib/services/audit-log.service';
import { buildPaginated } from '@/lib/utils/pagination';

/**
 * Service de gestion des utilisateurs (admin).
 *
 * Particularites :
 *   - Le flow invitation cree un `UserInvitation` (pas un `User`) :
 *     le compte est cree uniquement a l'acceptation, ce qui evite les
 *     comptes "fantomes" sans password.
 *   - Anti-replay : `usedAt` sur UserInvitation.
 *   - Anti-enum : on ne distingue pas "email deja invite" de "email
 *     deja user actif" cote API publique (a la charge du caller, ici
 *     on retourne EMAIL_ALREADY_EXISTS uniquement aux admins).
 *   - Garde-fou "dernier admin actif" sur disableUser.
 */

export type UserError =
  | 'NOT_FOUND'
  | 'INVALID'
  | 'EMAIL_ALREADY_EXISTS'
  | 'BOUTIQUE_NOT_FOUND'
  | 'LAST_ADMIN';

/**
 * Sous-ensemble strict des erreurs metier remontees par `inviteUser`.
 * Le service ne peut produire QUE ces deux cas (cf. implementation) -
 * on garde un type narrow pour que le caller (Server Action) n'ait
 * pas a gerer des branches impossibles (Clean Code #6 - types).
 */
export type InviteUserError = 'EMAIL_ALREADY_EXISTS' | 'BOUTIQUE_NOT_FOUND';

export type InvitationError = 'INVALID' | 'EXPIRED' | 'USED';
export type AcceptInvitationError = 'INVALID_OR_EXPIRED' | 'WEAK_PASSWORD';

interface ListUsersArgs {
  readonly query: PaginationQuery;
  readonly role?: UserRole;
  readonly includeInactive?: boolean;
}

interface InviteTokenIssued {
  readonly invitationId: string;
  readonly plainToken: string;
  readonly expiresAt: Date;
}

type UserWithBoutiques = User & {
  readonly boutiquesResponsable: readonly { readonly boutiqueId: string }[];
};

function mapUser(row: UserWithBoutiques): UserListItem {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    actif: row.actif,
    createdAt: row.createdAt,
    boutiqueSalarieId: row.boutiqueSalarieId,
    boutiqueIdsResponsable: row.boutiquesResponsable.map((b) => b.boutiqueId),
  };
}

export async function listUsers({
  query,
  role,
  includeInactive = false,
}: ListUsersArgs): Promise<PaginatedResult<UserListItem>> {
  // Filtre `role` poussee au WHERE Prisma pour que la pagination
  // s'applique aux items deja filtres (sinon une page peut sembler
  // vide alors que les pages suivantes contiennent encore des matchs).
  const where: Prisma.UserWhereInput = {
    ...(includeInactive ? {} : { actif: true }),
    ...(role ? { role } : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ actif: 'desc' }, { email: 'asc' }],
      skip,
      take: query.pageSize,
      include: { boutiquesResponsable: { select: { boutiqueId: true } } },
    }),
    db.user.count({ where }),
  ]);
  return buildPaginated(rows.map(mapUser), total, query);
}

export async function getUserById(
  id: string
): Promise<Result<UserListItem, 'NOT_FOUND'>> {
  const row = await db.user.findUnique({
    where: { id },
    include: { boutiquesResponsable: { select: { boutiqueId: true } } },
  });
  if (!row) {
    return { success: false, error: 'NOT_FOUND' };
  }
  return { success: true, data: mapUser(row) };
}

/**
 * Verifie que tous les boutiqueIds passes existent et sont actifs.
 * Retourne true si OK, false sinon.
 */
async function ensureActiveBoutiques(ids: readonly string[]): Promise<boolean> {
  if (ids.length === 0) {
    return true;
  }
  const count = await db.boutique.count({
    where: { id: { in: [...ids] }, actif: true },
  });
  return count === ids.length;
}

function collectInviteBoutiqueIds(input: UserInviteInput): readonly string[] {
  if (input.role === 'SALARIE' && input.boutiqueSalarieId) {
    return [input.boutiqueSalarieId];
  }
  if (input.role === 'RESPONSABLE') {
    return input.boutiquesResponsable;
  }
  return [];
}

/**
 * Cree une invitation. On NE cree PAS l'utilisateur ici : il sera
 * cree a l'acceptation pour qu'il ait un password defini par lui.
 *
 * Retourne le `plainToken` (a injecter dans l'URL email). Le hash
 * SHA256 est stocke en DB - meme un dump SQL ne permet pas de forger
 * un lien valide.
 */
export async function inviteUser(
  input: UserInviteInput,
  invitedById: string
): Promise<Result<InviteTokenIssued, InviteUserError>> {
  // MVP : on bloque toute invitation si un User existe deja avec cet
  // email, qu'il soit actif OU inactif. Sans ca, le flow d'acceptation
  // echouerait sur la contrainte unique `User.email` au moment du
  // `tx.user.create`. Le flow de reactivation d'un compte desactive
  // sera traite hors scope MVP via une action admin dediee.
  // TODO(US-ADM-005?): exposer un flow de reactivation explicite pour
  // les comptes desactives plutot que de forcer un nouvel email.
  const existingUser = await db.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existingUser) {
    return { success: false, error: 'EMAIL_ALREADY_EXISTS' };
  }
  const boutiqueIds = collectInviteBoutiqueIds(input);
  if (!(await ensureActiveBoutiques(boutiqueIds))) {
    return { success: false, error: 'BOUTIQUE_NOT_FOUND' };
  }

  const { plain, hash } = generateResetToken();
  const expiresAt = new Date(Date.now() + INVITATION_TOKEN_EXPIRY_MS);

  const created = await db.$transaction(async (tx) => {
    // Anti-accumulation : on invalide toute invitation pending precedente
    // (non utilisee, non expiree) pour ce meme email. Evite qu'un admin
    // reinvite n fois la meme personne et laisse n tokens valides
    // utilisables independamment.
    await tx.userInvitation.updateMany({
      where: {
        email: input.email,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });
    const invitation = await tx.userInvitation.create({
      data: {
        email: input.email,
        name: input.name,
        token: hash,
        role: input.role,
        expiresAt,
        invitedById,
        boutiqueSalarieId:
          input.role === 'SALARIE' ? (input.boutiqueSalarieId ?? null) : null,
        boutiquesResponsable:
          input.role === 'RESPONSABLE' ? [...input.boutiquesResponsable] : [],
      },
      select: { id: true },
    });
    await logAudit({
      action: 'CREATE',
      entityType: 'INVITATION',
      entityId: invitation.id,
      entityLabel: input.email,
      metadata: { role: input.role },
      performedById: invitedById,
      tx,
    });
    return invitation;
  });

  return {
    success: true,
    data: { invitationId: created.id, plainToken: plain, expiresAt },
  };
}

/**
 * Verifie qu'un token d'invitation est valide (existe, non expire,
 * non utilise). Retourne le payload necessaire au formulaire d'accept.
 */
export async function validateInvitationToken(
  plainToken: string
): Promise<Result<InvitationPayload, InvitationError>> {
  if (!plainToken || plainToken.length < 32) {
    return { success: false, error: 'INVALID' };
  }
  const tokenHash = hashToken(plainToken);
  const record = await db.userInvitation.findUnique({
    where: { token: tokenHash },
  });
  if (!record) {
    return { success: false, error: 'INVALID' };
  }
  if (record.usedAt !== null) {
    return { success: false, error: 'USED' };
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    return { success: false, error: 'EXPIRED' };
  }
  return {
    success: true,
    data: {
      id: record.id,
      email: record.email,
      name: record.name,
      role: record.role,
      expiresAt: record.expiresAt,
      boutiqueSalarieId: record.boutiqueSalarieId,
      boutiquesResponsable: record.boutiquesResponsable,
    },
  };
}

function buildAcceptUserData(args: {
  readonly email: string;
  readonly name: string | null;
  readonly role: UserRole;
  readonly passwordHash: string;
  readonly boutiqueSalarieId: string | null;
}): Prisma.UserCreateInput {
  return {
    email: args.email,
    // `name` est saisi par l'admin a l'invitation (cf. inviteUser).
    // Fallback sur l'email pour les anciennes invitations creees avant
    // l'ajout de la colonne `name` sur UserInvitation (compatibilite
    // avec les tokens encore valides au moment de la migration).
    name: args.name ?? args.email,
    password: args.passwordHash,
    role: args.role,
    ...(args.role === 'SALARIE' && args.boutiqueSalarieId
      ? { boutiqueSalarie: { connect: { id: args.boutiqueSalarieId } } }
      : {}),
  };
}

/**
 * Acceptation d'invitation atomique :
 *   1. Re-valide le token (DANS la transaction pour eviter une race).
 *   2. Marque l'invitation comme utilisee (usedAt).
 *   3. Cree le User avec le password hashe.
 *   4. Si RESPONSABLE : cree les liens BoutiqueUser.
 *
 * Toutes les erreurs token sont mappees sur INVALID_OR_EXPIRED
 * (generique cote UI pour ne pas leaker la cause).
 */
export async function acceptInvitation(
  plainToken: string,
  password: string
): Promise<Result<{ readonly user: User }, AcceptInvitationError>> {
  const validation = await validateInvitationToken(plainToken);
  if (!validation.success) {
    return { success: false, error: 'INVALID_OR_EXPIRED' };
  }
  const passwordHash = await hashPassword(password);
  const tokenHash = hashToken(plainToken);
  const now = new Date();

  try {
    const user = await db.$transaction(async (tx) => {
      const consumed = await tx.userInvitation.updateMany({
        where: { token: tokenHash, usedAt: null },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) {
        throw new Error('TOKEN_ALREADY_USED');
      }
      const createdUser = await tx.user.create({
        data: buildAcceptUserData({
          email: validation.data.email,
          name: validation.data.name,
          role: validation.data.role,
          passwordHash,
          boutiqueSalarieId: validation.data.boutiqueSalarieId,
        }),
      });
      if (
        validation.data.role === 'RESPONSABLE' &&
        validation.data.boutiquesResponsable.length > 0
      ) {
        await tx.boutiqueUser.createMany({
          data: validation.data.boutiquesResponsable.map((boutiqueId) => ({
            boutiqueId,
            userId: createdUser.id,
          })),
        });
      }
      return createdUser;
    });
    return { success: true, data: { user } };
  } catch {
    return { success: false, error: 'INVALID_OR_EXPIRED' };
  }
}

/**
 * Garde-fou : on refuse de desactiver le dernier admin actif. Pour
 * verifier on compte les admins actifs hors `id`. Si 0 -> on bloque.
 */
async function isLastActiveAdmin(id: string): Promise<boolean> {
  const otherAdmins = await db.user.count({
    where: { role: 'ADMIN', actif: true, NOT: { id } },
  });
  return otherAdmins === 0;
}

interface DisableUserArgs {
  readonly id: string;
  readonly performedById: string;
  readonly motif?: string;
}

interface EnableUserArgs {
  readonly id: string;
  readonly performedById: string;
}

/**
 * Soft-delete avec audit (US-ADM-004). Le garde-fou "dernier admin"
 * reste en place : on log uniquement si la mutation se produit.
 */
export async function disableUser({
  id,
  performedById,
  motif,
}: DisableUserArgs): Promise<Result<void, 'NOT_FOUND' | 'LAST_ADMIN'>> {
  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: 'NOT_FOUND' };
  }
  if (existing.role === 'ADMIN' && (await isLastActiveAdmin(id))) {
    return { success: false, error: 'LAST_ADMIN' };
  }
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { actif: false } });
    await logAudit({
      action: 'DISABLE',
      entityType: 'USER',
      entityId: id,
      entityLabel: existing.email,
      motif,
      performedById,
      tx,
    });
  });
  return { success: true, data: undefined };
}

export async function enableUser({
  id,
  performedById,
}: EnableUserArgs): Promise<Result<void, 'NOT_FOUND'>> {
  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: 'NOT_FOUND' };
  }
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { actif: true } });
    await logAudit({
      action: 'ENABLE',
      entityType: 'USER',
      entityId: id,
      entityLabel: existing.email,
      performedById,
      tx,
    });
  });
  return { success: true, data: undefined };
}
