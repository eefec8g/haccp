import { auth } from '@/lib/auth';
import { LogoutButton } from '@/components/features/auth/LogoutButton';

const ROLE_LABEL_FR: Readonly<Record<string, string>> = {
  ADMIN: 'Administrateur',
  RESPONSABLE: 'Responsable',
  SALARIE: 'Salarie',
} as const;

/**
 * Header de la zone admin (Server Component).
 *
 * Affiche l'email + role + bouton logout. La session est relue en SC
 * pour eviter toute fuite cote client (le JWT ne traverse pas le bundle
 * client). Si la session est absente le composant n'affiche que le
 * bouton de logout, le layout parent gere deja la redirection.
 */
export async function AdminHeader() {
  const session = await auth();
  const email = session?.user?.email ?? '';
  const role = session?.user?.role ?? null;
  const roleLabel = role ? (ROLE_LABEL_FR[role] ?? role) : '';

  return (
    <header
      className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[#DFE5EF] bg-white px-6"
      data-testid="admin-header"
    >
      <div className="lg:hidden">
        <span className="text-lg font-bold text-[#2A3547]">Maison Givre</span>
      </div>
      <div className="ml-auto flex items-center gap-4">
        {email ? (
          <div className="text-right">
            <p className="text-sm font-semibold text-[#2A3547]">{email}</p>
            {roleLabel ? (
              <p className="text-xs uppercase tracking-wider text-[#5D87FF]">
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
