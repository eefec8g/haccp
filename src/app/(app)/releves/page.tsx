import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { listTournee } from '@/lib/services/releve.service';
import { tourneeQuerySchema } from '@/lib/validations/releve';
import { getCurrentCreneau, todayParisISO } from '@/lib/utils/dates';
import { TourneeHeader } from '@/components/features/releves/TourneeHeader';
import { TourneeGrid } from '@/components/features/releves/TourneeGrid';

export const metadata: Metadata = {
  title: 'Ma tournee - HACCP Maison Givre',
  robots: { index: false, follow: false },
};

interface RelevesPageSearchParams {
  readonly date?: string;
}

interface RelevesPageProps {
  readonly searchParams: Promise<RelevesPageSearchParams>;
}

/**
 * Page tournee du jour (US-REL-001).
 *
 * Server Component async :
 *   - Auth check : redirect /login si pas de session (defense en
 *     profondeur, le middleware filtre deja en amont).
 *   - Parse optionnel de `?date=YYYY-MM-DD` (sinon today Europe/Paris).
 *   - Charge la tournee via le service (scope boutiques par role).
 *   - Calcule le creneau courant (heure Europe/Paris).
 *   - Rend TourneeHeader + TourneeGrid (aucun fetch client-side).
 *
 * Accessible aux 3 roles : SALARIE (sa boutique), RESPONSABLE
 * (toutes ses boutiques), ADMIN (toutes boutiques actives).
 */
export default async function RelevesPage({ searchParams }: RelevesPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const raw = await searchParams;
  const parsed = tourneeQuerySchema.safeParse({ date: raw.date });
  const dateISO =
    parsed.success && parsed.data.date ? parsed.data.date : todayParisISO();

  const viewer = { id: session.user.id, role: session.user.role };
  const cards = await listTournee({ viewer, dateISO });
  const currentCreneau = getCurrentCreneau();

  return (
    <main className="min-h-screen bg-mg-ivoire" data-testid="releves-page">
      <TourneeHeader
        dateISO={dateISO}
        userName={session.user.name ?? session.user.email ?? 'Utilisateur'}
        userRole={session.user.role}
      />
      <section className="px-6 py-10 sm:px-10">
        <TourneeGrid cards={cards} currentCreneau={currentCreneau} />
      </section>
    </main>
  );
}
