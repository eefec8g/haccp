import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Creneau } from '@prisma/client';
import { auth } from '@/lib/auth';
import { getSaisieContext } from '@/lib/services/releve.service';
import { CRENEAU_LABELS } from '@/lib/constants/releve';
import { SaisieReleveForm } from '@/components/features/releves/SaisieReleveForm';

/**
 * Page de saisie d'un releve (US-REL-002).
 *
 * Server Component async :
 *   - auth() : redirect /login si pas de session.
 *   - Valide les segments dynamiques (creneau enum, equipementId UUID
 *     non strict : deleguee a la DB).
 *   - Charge le contexte via le service (existence + boutique accessible
 *     + pas de releve actif deja existant).
 *   - Mapping erreurs service vers UX : NOT_FOUND/FORBIDDEN -> 404,
 *     ALREADY_EXISTS -> redirect /dashboard, EQUIPEMENT_INACTIVE -> message.
 *
 * Pourquoi pas de notFound() pour ALREADY_EXISTS : un releve deja saisi
 * n'est PAS une erreur 404. C'est un cas metier normal : on renvoie le
 * salarie sur le dashboard ou il verra l'etat "FAIT" sur le creneau.
 */

const DASHBOARD_PATH = '/dashboard';

interface SaisiePageParams {
  readonly equipementId: string;
  readonly creneau: string;
}

interface SaisiePageProps {
  readonly params: Promise<SaisiePageParams>;
}

function isCreneau(value: string): value is Creneau {
  return value in Creneau;
}

export async function generateMetadata({
  params,
}: SaisiePageProps): Promise<Metadata> {
  const { creneau } = await params;
  const label = isCreneau(creneau) ? CRENEAU_LABELS[creneau] : 'Saisie';
  return {
    title: `${label} - Saisie releve - HACCP Maison Givre`,
    robots: { index: false, follow: false },
  };
}

export default async function SaisieReleveePage({ params }: SaisiePageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const { equipementId, creneau } = await params;
  if (!isCreneau(creneau)) {
    notFound();
  }

  const context = await getSaisieContext({
    viewer: { id: session.user.id, role: session.user.role },
    equipementId,
    creneau,
  });

  if (!context.success) {
    if (context.error === 'ALREADY_EXISTS') {
      redirect(DASHBOARD_PATH);
    }
    if (
      context.error === 'EQUIPEMENT_NOT_FOUND' ||
      context.error === 'BOUTIQUE_FORBIDDEN'
    ) {
      notFound();
    }
    // EQUIPEMENT_INACTIVE (le seul cas restant a ce stade) : message UX
    // clair plutot que 404, car le salarie peut interroger l'admin pour
    // qu'il reactive l'equipement.
    return (
      <main className="min-h-screen bg-mg-ivoire" data-testid="saisie-page">
        <Breadcrumb />
        <section className="mx-auto max-w-xl px-6 py-16 sm:px-10">
          <div
            className="border border-mg-or/40 bg-mg-or/5 px-6 py-8 text-center text-sm font-light text-mg-noir"
            data-testid="saisie-equipement-inactive"
          >
            <p className="text-[10px] uppercase tracking-[0.3em] text-mg-or">
              Equipement desactive
            </p>
            <p className="mt-3 leading-relaxed">
              Cet equipement est actuellement desactive. Contactez un
              administrateur pour le reactiver avant de saisir un releve.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-mg-ivoire" data-testid="saisie-page">
      <Breadcrumb />
      <section className="mx-auto max-w-xl px-6 py-10 sm:px-10">
        <SaisieReleveForm context={context.data} />
      </section>
    </main>
  );
}

function Breadcrumb() {
  return (
    <nav
      aria-label="Fil d'Ariane"
      className="border-b border-mg-noir/10 bg-mg-ivoire px-6 py-4 sm:px-10"
      data-testid="saisie-breadcrumb"
    >
      <Link
        href={DASHBOARD_PATH}
        className="text-[10px] uppercase tracking-[0.3em] text-mg-noir/60 transition-colors hover:text-mg-or focus:text-mg-or focus:outline-none"
        data-testid="saisie-back-link"
      >
        &larr; Tableau de bord
      </Link>
    </nav>
  );
}
