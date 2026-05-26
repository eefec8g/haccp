import type { Metadata } from 'next';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { listRecentsBySalarie } from '@/lib/services/releve.service';
import { releveHistoryQuerySchema } from '@/lib/validations/releve';
import { DAYS_RECENT_HISTORY } from '@/lib/constants/releve';
import { ReleveHistoryList } from '@/components/features/releves/ReleveHistoryList';
import { AppPageHeader } from '@/components/features/ui/AppPageHeader';

export const metadata: Metadata = {
  title: 'Historique - HACCP Maison Givre',
  robots: { index: false, follow: false },
};

interface HistoriqueSearchParams {
  readonly page?: string;
  readonly pageSize?: string;
  readonly equipementId?: string;
}

interface HistoriquePageProps {
  readonly searchParams: Promise<HistoriqueSearchParams>;
}

const SECTION_CLASSES = 'px-6 py-10 sm:px-10';
const BACK_HREF: Route = '/releves';
const PAGE_TITLE = 'Mes releves recents';
const PAGE_SUBTITLE = `Fenetre glissante des ${DAYS_RECENT_HISTORY} derniers jours.`;

/**
 * Page historique des releves recents du salarie (US-REL-003).
 *
 * Server Component async :
 *   - Auth check : redirect /login si pas de session (defense en
 *     profondeur, le middleware filtre deja en amont).
 *   - Parse les query params (page / pageSize / equipementId) via Zod,
 *     defauts surs si la chaine est invalide (page=1, pageSize=20).
 *   - Charge l'historique paginated du salarie connecte.
 *   - Rend un header sobre + lien retour + la liste.
 *
 * Accessible aux 3 roles (chacun voit ses propres releves : le service
 * scope par `viewer.id`).
 */
export default async function ReleveHistoriquePage({
  searchParams,
}: HistoriquePageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const raw = await searchParams;
  const parsed = releveHistoryQuerySchema.safeParse(raw);
  const query = parsed.success
    ? parsed.data
    : { page: 1, pageSize: 20, equipementId: undefined };

  const viewer = { id: session.user.id, role: session.user.role };
  const result = await listRecentsBySalarie({ viewer, query });

  return (
    <main
      className="min-h-screen bg-mg-ivoire"
      data-testid="releves-history-page"
    >
      <AppPageHeader
        eyebrow="Maison Givre"
        title={PAGE_TITLE}
        subtitle={PAGE_SUBTITLE}
        backHref={BACK_HREF}
        backLabel="Retour a la tournee"
        testId="releves-history-header"
      />
      <section className={SECTION_CLASSES}>
        <ReleveHistoryList
          items={result.items}
          pagination={{
            page: result.page,
            pageSize: result.pageSize,
            total: result.total,
            totalPages: result.totalPages,
          }}
        />
      </section>
    </main>
  );
}
