import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Route } from 'next';
import { UserRole } from '@prisma/client';
import { AdminPageHeader } from '@/components/features/admin/AdminPageHeader';
import { UserToggleActiveButton } from '@/components/features/admin/UserToggleActiveButton';
import { StatusBadge } from '@/components/features/admin/StatusBadge';
import { getUserById } from '@/lib/services/user.service';
import { getBoutiquesByIds } from '@/lib/services/boutique.service';
import { USER_ROLE_LABELS } from '@/lib/constants/user-labels';

export const metadata: Metadata = {
  title: 'Detail utilisateur - Administration HACCP',
};

interface AdminUserDetailPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

const BACK_LINK_CLASSES =
  'inline-flex items-center justify-center rounded-[7px] border border-[#DFE5EF] bg-white px-3 py-1.5 text-sm font-medium text-[#5A6A85] transition-colors hover:bg-[#F6F9FC] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2';
const SECTION_CLASSES =
  'rounded-[7px] border border-[#DFE5EF] bg-white p-6 space-y-3';
const KEY_CLASSES = 'text-xs uppercase tracking-wider text-[#5A6A85]';
const VALUE_CLASSES = 'text-sm font-medium text-[#2A3547]';
const CHIP_CLASSES =
  'inline-flex items-center rounded-full bg-[#ECF2FF] px-3 py-1 text-xs font-medium text-[#3B5BB8]';

interface BoutiqueOption {
  readonly id: string;
  readonly nom: string;
  readonly ville: string | null;
}

function formatBoutique(boutique: BoutiqueOption): string {
  if (boutique.ville && boutique.ville.length > 0) {
    return `${boutique.nom} - ${boutique.ville}`;
  }
  return boutique.nom;
}

function collectBoutiqueIds(args: {
  readonly role: UserRole;
  readonly boutiqueSalarieId: string | null;
  readonly boutiqueIdsResponsable: readonly string[];
}): readonly string[] {
  if (args.role === 'SALARIE' && args.boutiqueSalarieId) {
    return [args.boutiqueSalarieId];
  }
  if (args.role === 'RESPONSABLE') {
    return args.boutiqueIdsResponsable;
  }
  return [];
}

/**
 * Page de detail d'un utilisateur (Server Component, US-ADM-003).
 *
 * Affiche les attributs cles (email, nom, role, boutiques, statut) +
 * permet la desactivation/reactivation via `UserToggleActiveButton`.
 * Le layout parent garantit deja auth + role ADMIN. Si l'id n'existe
 * pas -> notFound() (404 propre Next.js).
 */
export default async function AdminUserDetailPage({
  params,
}: AdminUserDetailPageProps) {
  const { id } = await params;
  const result = await getUserById(id);
  if (!result.success) {
    notFound();
  }
  const user = result.data;

  // Perf : on ne charge que les boutiques effectivement liees au user
  // (1 a quelques ids max) au lieu de scanner toute la table. Cf.
  // `getBoutiquesByIds` dans boutique.service.
  const boutiqueIds = collectBoutiqueIds({
    role: user.role,
    boutiqueSalarieId: user.boutiqueSalarieId,
    boutiqueIdsResponsable: user.boutiqueIdsResponsable,
  });
  const boutiques = await getBoutiquesByIds(boutiqueIds);

  return (
    <div data-testid={`admin-user-detail-${user.id}`}>
      <AdminPageHeader
        title={user.email}
        subtitle={`${USER_ROLE_LABELS[user.role]} - ${user.name}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              variant={user.actif ? 'active' : 'inactive'}
              data-testid="user-status"
            />
            <Link
              href={'/admin/users' as Route}
              className={BACK_LINK_CLASSES}
              data-testid="user-back-link"
            >
              Retour a la liste
            </Link>
            <UserToggleActiveButton
              userId={user.id}
              userLabel={user.email}
              actif={user.actif}
            />
          </div>
        }
      />

      <section
        className={SECTION_CLASSES}
        aria-label="Informations utilisateur"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className={KEY_CLASSES}>Email</p>
            <p className={VALUE_CLASSES} data-testid="user-detail-email">
              {user.email}
            </p>
          </div>
          <div>
            <p className={KEY_CLASSES}>Nom</p>
            <p className={VALUE_CLASSES} data-testid="user-detail-name">
              {user.name}
            </p>
          </div>
          <div>
            <p className={KEY_CLASSES}>Role</p>
            <p className={VALUE_CLASSES} data-testid="user-detail-role">
              {USER_ROLE_LABELS[user.role]}
            </p>
          </div>
          <div>
            <p className={KEY_CLASSES}>Date de creation</p>
            <p className={VALUE_CLASSES} data-testid="user-detail-created-at">
              {user.createdAt.toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>

        <div>
          <p className={KEY_CLASSES}>Boutiques</p>
          {user.role === 'ADMIN' ? (
            <p
              className={`${VALUE_CLASSES} mt-1`}
              data-testid="user-detail-boutiques-admin"
            >
              Acces a toutes les boutiques (administrateur).
            </p>
          ) : boutiques.length === 0 ? (
            <p
              className={`${VALUE_CLASSES} mt-1 text-[#5A6A85]`}
              data-testid="user-detail-boutiques-empty"
            >
              Aucune boutique rattachee.
            </p>
          ) : (
            <ul
              className="mt-2 flex flex-wrap gap-2"
              data-testid="user-detail-boutiques"
            >
              {boutiques.map((b) => (
                <li key={b.id} className={CHIP_CLASSES}>
                  {formatBoutique(b)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
