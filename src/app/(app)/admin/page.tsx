import Link from 'next/link';
import type { Metadata } from 'next';
import type { Route } from 'next';
import type { ReactNode } from 'react';
import { AdminPageHeader } from '@/components/features/admin/AdminPageHeader';

export const metadata: Metadata = {
  title: 'Administration - HACCP Maison Givre',
};

interface AdminShortcut {
  readonly href: Route;
  readonly label: string;
  readonly description: string;
  readonly testid: string;
  readonly icon: ReactNode;
}

const ICON_CLASSES = 'h-6 w-6 text-mg-or';

const ADMIN_SHORTCUTS: readonly AdminShortcut[] = [
  {
    href: '/admin/boutiques' as Route,
    label: 'BOUTIQUES',
    description: 'Parc des points de vente Maison Givre.',
    testid: 'admin-shortcut-boutiques',
    icon: (
      <svg
        aria-hidden="true"
        className={ICON_CLASSES}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 9.75 5 5h14l2 4.75M3 9.75V19a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9.75M3 9.75h18M9 14h6"
        />
      </svg>
    ),
  },
  {
    href: '/admin/equipements' as Route,
    label: 'EQUIPEMENTS',
    description: 'Congelateurs, vitrines et chambres froides.',
    testid: 'admin-shortcut-equipements',
    icon: (
      <svg
        aria-hidden="true"
        className={ICON_CLASSES}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm-1 8h14M9 7h.01M9 15h.01"
        />
      </svg>
    ),
  },
  {
    href: '/admin/users' as Route,
    label: 'UTILISATEURS',
    description: 'Comptes salaries, responsables et administrateurs.',
    testid: 'admin-shortcut-users',
    icon: (
      <svg
        aria-hidden="true"
        className={ICON_CLASSES}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 21v-2a4 4 0 0 0-3-3.87M7 21v-2a4 4 0 0 1 3-3.87m6-5.13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
        />
      </svg>
    ),
  },
  {
    href: '/admin/audit-log' as Route,
    label: 'JOURNAL D AUDIT',
    description: 'Tracabilite des actions administratives.',
    testid: 'admin-shortcut-audit',
    icon: (
      <svg
        aria-hidden="true"
        className={ICON_CLASSES}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 7h6m-6 4h4"
        />
      </svg>
    ),
  },
];

/**
 * Dashboard admin (US-ADM-005, charte Maison Givre).
 *
 * Page d'accueil de l'espace admin : 4 cartes de raccourci vers les
 * sections cles. Les widgets statistiques detailles (parc, conformite,
 * alertes) restent a integrer dans une iteration ulterieure.
 */
export default function AdminDashboardPage() {
  return (
    <>
      <AdminPageHeader
        title="Espace admin"
        subtitle="Pilotez le parc Maison Givre : boutiques, equipements, utilisateurs et tracabilite des actions."
      />
      <section
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        data-testid="admin-dashboard-shortcuts"
        aria-label="Raccourcis administration"
      >
        {ADMIN_SHORTCUTS.map((item) => (
          <Link
            key={item.testid}
            href={item.href}
            data-testid={item.testid}
            className="group flex flex-col gap-4 border border-mg-noir/10 bg-mg-ivoire p-6 transition-colors hover:border-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center border border-mg-or/30 bg-transparent transition-colors group-hover:border-mg-or">
              {item.icon}
            </span>
            <span className="block text-xs font-light uppercase tracking-[0.3em] text-mg-noir">
              {item.label}
            </span>
            <span
              aria-hidden="true"
              className="block h-px w-8 bg-mg-or transition-all group-hover:w-12"
            />
            <span className="text-sm font-light text-mg-noir/60">
              {item.description}
            </span>
            <span className="mt-auto text-[10px] font-light uppercase tracking-[0.3em] text-mg-noir/40 transition-colors group-hover:text-mg-or">
              Acceder →
            </span>
          </Link>
        ))}
      </section>
    </>
  );
}
