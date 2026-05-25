import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { LogoutButton } from '@/components/features/auth/LogoutButton';

export const metadata: Metadata = {
  title: 'Mes releves - HACCP Maison Givre',
};

/**
 * Page placeholder des releves (charte Maison Givre).
 *
 * Le module de saisie (US-REL-001 / US-REL-002) sera implemente dans le
 * sprint v1.0. Cette page affiche un placeholder coherent avec la charte
 * et permet aux roles ADMIN de revenir vers l'espace admin.
 */
export default async function RelevesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const isAdmin = session.user.role === 'ADMIN';
  const backHref: Route = isAdmin ? ('/admin' as Route) : ('/' as Route);
  const backLabel = isAdmin ? 'Espace admin' : 'Accueil';

  return (
    <main className="min-h-screen bg-mg-ivoire">
      <header
        className="flex flex-col gap-4 border-b border-mg-noir/10 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-10"
        data-testid="releves-header"
      >
        <div>
          <p className="text-[10px] font-light uppercase tracking-[0.3em] text-mg-or">
            Maison Givre
          </p>
          <p className="mt-1 text-sm font-light text-mg-noir/60">
            {session.user.name}
            <span className="ml-2 text-mg-noir/40">- {session.user.role}</span>
          </p>
        </div>
        <LogoutButton />
      </header>

      <section
        className="mx-auto max-w-3xl px-6 py-16 text-center sm:py-24"
        data-testid="releves-placeholder"
      >
        <h1 className="text-2xl font-light uppercase tracking-[0.4em] text-mg-noir sm:text-3xl">
          Mes releves
        </h1>
        <span
          aria-hidden="true"
          className="mx-auto mt-6 inline-block h-px w-16 bg-mg-or"
        />
        <p className="mt-8 text-sm font-light leading-relaxed text-mg-noir/60">
          Module de saisie des temperatures - bientot disponible.
        </p>
        <p className="mt-3 text-xs font-light italic text-mg-noir/40">
          La grille equipements x creneaux (matin / midi / soir) sera mise en
          service avec le sprint v1.0.
        </p>

        <div className="mt-12">
          <Link
            href={backHref}
            data-testid="releves-back-link"
            className="inline-flex items-center justify-center border border-mg-or/40 bg-transparent px-8 py-3 text-[11px] font-light uppercase tracking-[0.3em] text-mg-or transition-colors hover:bg-mg-or hover:text-mg-noir focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire"
          >
            Retour - {backLabel}
          </Link>
        </div>
      </section>
    </main>
  );
}
