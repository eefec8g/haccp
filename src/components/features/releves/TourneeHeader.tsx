import type { UserRole } from '@prisma/client';
import { LogoutButton } from '@/components/features/auth/LogoutButton';
import { DateCourte } from './DateCourte';

/**
 * En-tete de la page tournee du jour (US-REL-001).
 *
 * Server Component pur (charte Maison Givre) : titre "Ma tournee du
 * jour", date courte `JJ/MM/AAAA`, identite + role du viewer, bouton
 * de deconnexion. Aucune interactivite hors LogoutButton (lui-meme
 * Server Component avec server action).
 *
 * Visuel calque sur l'esthetique des pages admin (eyebrow or, titre
 * leger en CAPITALES, divider fin or sous le titre).
 *
 * a11y :
 *   - `<header role="banner">` (aria role natif).
 *   - `<time dateTime>` via DateCourte (lecture machine + humaine).
 */
interface TourneeHeaderProps {
  readonly dateISO: string;
  readonly userName: string;
  readonly userRole: UserRole;
}

const ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  SALARIE: 'Salarie',
  RESPONSABLE: 'Responsable',
  ADMIN: 'Administrateur',
} as const;

export function TourneeHeader({
  dateISO,
  userName,
  userRole,
}: TourneeHeaderProps) {
  return (
    <header
      className="flex flex-col gap-6 border-b border-mg-noir/10 bg-mg-ivoire px-6 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-10"
      data-testid="tournee-header"
    >
      <div>
        <p className="text-[10px] font-light uppercase tracking-[0.3em] text-mg-or">
          Maison Givre
        </p>
        <h1 className="mt-2 text-2xl font-light uppercase tracking-[0.2em] text-mg-noir sm:text-3xl">
          Ma tournee du jour
        </h1>
        <span
          aria-hidden="true"
          className="mt-4 inline-block h-px w-12 bg-mg-or"
        />
        <p className="mt-4 text-sm font-light text-mg-noir/60">
          <DateCourte
            value={dateISO}
            className="font-medium text-mg-noir"
            data-testid="tournee-header-date"
          />
          <span className="ml-3 text-mg-noir/40">|</span>
          <span className="ml-3" data-testid="tournee-header-user">
            {userName}
          </span>
          <span
            className="ml-2 text-[10px] uppercase tracking-[0.3em] text-mg-or"
            data-testid="tournee-header-role"
          >
            {ROLE_LABELS[userRole]}
          </span>
        </p>
      </div>
      <div className="flex justify-start sm:justify-end">
        <LogoutButton />
      </div>
    </header>
  );
}
