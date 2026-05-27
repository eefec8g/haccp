import type { Metadata } from 'next';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/prisma';
import {
  canExport,
  getAccessibleBoutiqueIds,
  type SessionUser,
} from '@/lib/permissions';
import { todayParisISO } from '@/lib/utils/dates';
import { resolveExportErrorMessage } from '@/lib/utils/export-error-messages';
import { AppPageHeader } from '@/components/features/ui/AppPageHeader';
import { ExportForm } from '@/components/features/export/ExportForm';

/**
 * Page `/releves/registre` (US-EXP-002).
 *
 * Server Component qui rend le formulaire de generation du "Registre
 * journalier" PDF (1 jour x 1 boutique = format CCF DDPP). Submit GET
 * vers `/api/exports/pdf` qui repond avec un Content-Disposition
 * attachment pour declencher le download natif.
 *
 * Permissions : RESPONSABLE + ADMIN. SALARIE redirige vers /releves.
 */

export const metadata: Metadata = {
  title: 'Registre journalier - HACCP Maison Givre',
  robots: { index: false, follow: false },
};

const RELEVES_PATH = '/releves' as Route;
const PDF_ACTION_URL = '/api/exports/pdf';

/**
 * Borne defensive sur le `findMany` boutiques pour eviter de tirer des
 * milliers de lignes si un viewer accumule un perimetre tres large.
 */
const MAX_BOUTIQUES = 100;

interface RegistrePageProps {
  readonly searchParams: Promise<{
    readonly error?: string;
    readonly retry?: string;
  }>;
}

export default async function RegistreJournalierPage({
  searchParams,
}: RegistrePageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  const viewer: SessionUser = {
    id: session.user.id,
    role: session.user.role,
  };
  if (!canExport(viewer)) {
    redirect(RELEVES_PATH);
  }

  const [boutiqueIds, params] = await Promise.all([
    getAccessibleBoutiqueIds(viewer),
    searchParams,
  ]);

  const boutiques =
    boutiqueIds.length > 0
      ? await db.boutique.findMany({
          where: { id: { in: boutiqueIds }, actif: true },
          orderBy: { nom: 'asc' },
          select: { id: true, nom: true },
          take: MAX_BOUTIQUES,
        })
      : [];

  const errorMessage = resolveExportErrorMessage(params.error, params.retry);

  return (
    <main className="min-h-screen bg-mg-ivoire" data-testid="export-pdf-page">
      <AppPageHeader
        eyebrow="MAISON GIVRE - HACCP"
        title="Registre journalier"
        subtitle="Generez le registre journalier PDF d'une boutique (audit DDPP)."
        backHref={RELEVES_PATH}
        backLabel="Mes releves"
        testId="export-pdf-header"
      />
      <section className="mx-auto max-w-2xl px-6 py-12 sm:px-10">
        <ExportForm
          mode="pdf"
          actionUrl={PDF_ACTION_URL}
          boutiques={boutiques}
          defaultDateISO={todayParisISO()}
          errorMessage={errorMessage}
        />
      </section>
    </main>
  );
}
