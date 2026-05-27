import { auth } from '@/lib/auth';
import { LogoutButton } from '@/components/features/auth/LogoutButton';
import { AdminMobileMenu } from './AdminMobileMenu';

const ROLE_LABEL_FR: Readonly<Record<string, string>> = {
  ADMIN: 'Administrateur',
  RESPONSABLE: 'Responsable',
  SALARIE: 'Salarie',
} as const;

/**
 * Header de la zone admin (Server Component).
 *
 * Charte Maison Givre : sticky en haut du main, fond ivoire, fine
 * border-bottom noire opaque, typographie sobre. Affiche l'email + role
 * a droite avec le bouton de logout. La session est relue server-side
 * pour eviter toute fuite cote client (JWT ne traverse pas le bundle).
 */
export async function AdminHeader() {
  const session = await auth();
  const email = session?.user?.email ?? '';
  const role = session?.user?.role ?? null;
  const roleLabel = role ? (ROLE_LABEL_FR[role] ?? role) : '';

  return (
    <header
      className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-mg-noir/10 bg-mg-ivoire px-6 lg:px-10"
      data-testid="admin-header"
    >
      <div className="flex items-center gap-4 lg:hidden">
        <AdminMobileMenu />
        <span className="text-sm font-semibold tracking-[0.3em] text-mg-noir uppercase">
          Maison Givre
        </span>
      </div>
      <div className="ml-auto flex items-center gap-6">
        {email ? (
          <div className="text-right">
            <p className="text-xs font-medium tracking-wide text-mg-noir">
              {email}
            </p>
            {roleLabel ? (
              <p className="mt-0.5 text-[10px] font-light tracking-[0.3em] text-mg-or uppercase">
                {roleLabel}
              </p>
            ) : null}
          </div>
        ) : null}
        <LogoutButton />
      </div>
    </header>
  );
}
