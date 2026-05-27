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
 * Page `/releves/export` (US-EXP-001).
 *
 * Server Component qui rend le formulaire d'export CSV. Le submit GET
 * file directement vers `/api/exports/csv` (Route Handler) qui repond
 * avec un Content-Disposition attachment pour declencher le download
 * native.
 *
 * Permissions : RESPONSABLE + ADMIN seulement (canExport). SALARIE
 * redirige vers /releves (anti-enum, on n'expose pas l'existence de
 * la page).
 *
 * Filtre dynamique boutique -> equipements : on charge les equipements
 * actifs des boutiques accessibles. Le composant client filtre en
 * fonction de la selection.
 */

export const metadata: Metadata = {
  title: 'Export CSV - HACCP Maison Givre',
  robots: { index: false, follow: false },
};

const RELEVES_PATH = '/releves' as Route;
const CSV_ACTION_URL = '/api/exports/csv';

/**
 * Bornes defensives sur les `findMany` boutiques/equipements : si un
 * jour un viewer accumule un perimetre tres large, on evite de tirer
 * des milliers de lignes pour peupler un <select>. Valeurs largement
 * au-dessus des besoins reels Maison Givre (10 boutiques, ~50 equip.).
 */
const MAX_BOUTIQUES = 100;
const MAX_EQUIPEMENTS = 500;

interface ExportPageProps {
  readonly searchParams: Promise<{
    readonly error?: string;
    readonly retry?: string;
  }>;
}

export default async function ExportCsvPage({ searchParams }: ExportPageProps) {
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

  // Perf : les 2 queries sont independantes (boutiques + equipements
  // partagent la meme contrainte `boutiqueId IN (boutiqueIds)`). On les
  // lance en parallele plutot qu'en sequence.
  const [boutiques, equipements] =
    boutiqueIds.length > 0
      ? await Promise.all([
          db.boutique.findMany({
            where: { id: { in: boutiqueIds }, actif: true },
            orderBy: { nom: 'asc' },
            select: { id: true, nom: true },
            take: MAX_BOUTIQUES,
          }),
          db.equipement.findMany({
            where: { boutiqueId: { in: boutiqueIds }, actif: true },
            orderBy: { nom: 'asc' },
            select: { id: true, nom: true, boutiqueId: true },
            take: MAX_EQUIPEMENTS,
          }),
        ])
      : [[], []];

  const errorMessage = resolveExportErrorMessage(params.error, params.retry);

  return (
    <main className="min-h-screen bg-mg-ivoire" data-testid="export-csv-page">
      <AppPageHeader
        eyebrow="MAISON GIVRE - HACCP"
        title="Export CSV"
        subtitle="Exportez les releves de temperature au format CSV (audit DDPP)."
        backHref={RELEVES_PATH}
        backLabel="Mes releves"
        testId="export-csv-header"
      />
      <section className="mx-auto max-w-2xl px-6 py-12 sm:px-10">
        <ExportForm
          mode="csv"
          actionUrl={CSV_ACTION_URL}
          boutiques={boutiques}
          equipements={equipements}
          defaultDateISO={todayParisISO()}
          errorMessage={errorMessage}
        />
      </section>
    </main>
  );
}
