import type { Metadata } from 'next';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { canManageAlertes } from '@/lib/permissions';
import { listAlertesOuvertes } from '@/lib/services/alerte.service';
import { AlerteList } from '@/components/features/alertes/AlerteList';
import { AppPageHeader } from '@/components/features/ui/AppPageHeader';

export const metadata: Metadata = {
  title: 'Alertes - HACCP Maison Givre',
  robots: { index: false, follow: false },
};

interface AlertesPageSearchParams {
  readonly page?: string;
  readonly pageSize?: string;
}

interface AlertesPageProps {
  readonly searchParams: Promise<AlertesPageSearchParams>;
}

const alertesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

const BACK_HREF: Route = '/dashboard';
const SECTION_CLASSES = 'px-6 py-10 sm:px-10';
const PAGE_TITLE = 'Alertes ouvertes';
const PAGE_SUBTITLE = 'Releves hors seuils en attente de resolution.';

/**
 * Page liste des alertes ouvertes (US-ALE-001).
 *
 * Server Component async :
 *   - Auth check : redirect /login si pas de session (defense en
 *     profondeur, le middleware filtre deja en amont).
 *   - Lecture ouverte aux trois roles : le SALARIE consulte les alertes
 *     de SA boutique (lecture seule), la liste etant scopee par
 *     `getAccessibleBoutiqueIds` cote service (multi-tenant strict).
 *   - `canManage` (RESPONSABLE/ADMIN) conditionne l'affichage des actions
 *     de resolution ; le SALARIE voit la liste sans bouton "Resoudre".
 *   - Parse les query params (page / pageSize) via Zod, defauts surs.
 *   - Rend un header sobre + lien retour + la liste.
 */
export default async function AlertesPage({ searchParams }: AlertesPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  const viewer = { id: session.user.id, role: session.user.role };
  const canManage = canManageAlertes(viewer);

  const raw = await searchParams;
  const parsed = alertesQuerySchema.safeParse(raw);
  const pagination = parsed.success ? parsed.data : { page: 1, pageSize: 20 };

  const result = await listAlertesOuvertes({ viewer, pagination });

  return (
    <main className="min-h-screen bg-mg-ivoire" data-testid="alertes-page">
      <AppPageHeader
        eyebrow="Maison Givre"
        title={PAGE_TITLE}
        subtitle={PAGE_SUBTITLE}
        backHref={BACK_HREF}
        backLabel="Tableau de bord"
        testId="alertes-header"
      />
      <section className={SECTION_CLASSES}>
        <AlerteList
          items={result.items}
          canManage={canManage}
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
