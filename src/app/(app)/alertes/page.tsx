import type { Metadata } from 'next';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
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

const BACK_HREF: Route = '/releves';
const SECTION_CLASSES = 'px-6 py-10 sm:px-10';
const PAGE_TITLE = 'Alertes ouvertes';
const PAGE_SUBTITLE = 'Releves hors seuils en attente de resolution.';

/**
 * Page liste des alertes ouvertes (US-ALE-001).
 *
 * Server Component async :
 *   - Auth check : redirect /login si pas de session (defense en
 *     profondeur, le middleware filtre deja en amont).
 *   - Role check : notFound() si role non habilite (anti-enum : on
 *     n'expose pas l'existence de la page aux salaries).
 *   - Parse les query params (page / pageSize) via Zod, defauts surs.
 *   - Charge la liste paginee scopee aux boutiques accessibles.
 *   - Rend un header sobre + lien retour + la liste.
 */
export default async function AlertesPage({ searchParams }: AlertesPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  const viewer = { id: session.user.id, role: session.user.role };
  if (!canManageAlertes(viewer)) {
    notFound();
  }

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
        backLabel="Retour a la tournee"
        testId="alertes-header"
      />
      <section className={SECTION_CLASSES}>
        <AlerteList
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
