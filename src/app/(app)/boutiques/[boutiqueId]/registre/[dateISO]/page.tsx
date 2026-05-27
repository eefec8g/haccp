import type { Metadata } from 'next';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { readRegistreJournalier } from '@/lib/services/export.service';
import { formatDateShort } from '@/lib/utils/dates';
import { formatTemperature } from '@/lib/utils/format-temperature';
import { AppPageHeader } from '@/components/features/ui/AppPageHeader';
import { SignatureSection } from '@/components/features/signature/SignatureSection';
import type { SessionUser } from '@/lib/permissions';
import {
  ALERTE_STATUS_PDF_LABELS,
  CRENEAU_PDF_LABELS,
} from '@/lib/constants/export';
import type {
  RegistreJournalier,
  RegistreJournalierAlerteEntry,
  RegistreJournalierRow,
} from '@/types/export';

/**
 * Page detail du registre journalier `(boutique, date)` (US-SIG-001).
 *
 * Server Component async :
 *   - Auth (redirect /login si absente).
 *   - Charge `buildRegistreJournalier` qui gere le scope multi-tenant
 *     (notFound si la boutique est hors perimetre, anti-enum).
 *   - Rend recap releves + alertes + section signature.
 *   - Permet le download PDF via lien GET `/api/exports/pdf?...`.
 *
 * Difference vs `/releves/registre` : cette page est un detail orienté
 * lecture/signature pour une journee precise. `/releves/registre` reste
 * le formulaire de selection (boutique + date) pour l'export PDF
 * (Epic EXPORT).
 *
 * Note securite : on utilise `readRegistreJournalier` (et non
 * `buildRegistreJournalierForExport` reserve a l'export PDF). Cette
 * variante ouvre l'acces aux 3 roles (SALARIE inclus) tant que la
 * boutique est dans le scope. La signature est chargee separement par
 * `SignatureSection`, ce qui evite un double fetch et permet au SALARIE
 * d'acceder a la page pour signer.
 *
 * `dynamic = 'force-dynamic'` : la signature peut etre creee a tout
 * moment (Server Action + revalidatePath). Le cache statique de Next.js
 * n'a pas de sens ici (1 page = 1 jour x 1 boutique = lecteurs varies).
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Registre journalier - HACCP Maison Givre',
  robots: { index: false, follow: false },
};

const SECTION_CLASSES = 'px-6 py-10 sm:px-10';
const STACK_CLASSES = 'mx-auto flex max-w-5xl flex-col gap-10';
const HEADER_EYEBROW_PREFIX = 'MAISON GIVRE - HACCP';
const BACK_LABEL = 'Retour au registre';
const TABLE_TITLE = 'Releves de la journee';
const ALERTES_TITLE = 'Alertes du jour';
const NO_RELEVES = 'Aucun releve enregistre pour cette journee.';
const NO_ALERTES = 'Aucune alerte enregistree pour cette journee.';
const EXPORT_BUTTON_LABEL = 'Exporter le PDF';

/**
 * `min-w-[600px]` empeche les colonnes (5 creneaux + equipement + seuils)
 * de s'ecraser ; combine au wrapper `overflow-x-auto`, on garde la
 * lisibilite sur mobile en autorisant un swipe horizontal localise.
 */
const TABLE_CLASSES = 'w-full min-w-[600px] text-sm text-left border-collapse';
const TABLE_WRAPPER_CLASSES = '-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0';
const TH_CLASSES =
  'border-b border-mg-noir/10 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.2em] text-mg-noir/70';
const TD_CLASSES =
  'border-b border-mg-noir/5 px-3 py-2 font-light text-mg-noir';
const SUBSECTION_CLASSES = 'flex flex-col gap-4';
const SUBSECTION_TITLE_CLASSES =
  'text-lg font-light uppercase tracking-[0.2em] text-mg-noir';
const EMPTY_CLASSES =
  'border border-dashed border-mg-noir/15 bg-mg-ivoire/40 px-5 py-8 text-center text-sm font-light text-mg-noir/60';
const EXPORT_LINK_CLASSES =
  'inline-flex items-center justify-center bg-mg-noir px-6 py-3 text-[11px] font-light uppercase tracking-[0.3em] text-mg-ivoire transition-colors hover:bg-mg-or hover:text-mg-noir focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';
const ALERTE_LINE_CLASSES = 'text-sm font-light text-mg-noir';

const RELEVES_PATH = '/releves' as Route;

interface RegistreDetailPageProps {
  readonly params: Promise<{
    readonly boutiqueId: string;
    readonly dateISO: string;
  }>;
}

function buildExportPdfHref(boutiqueId: string, dateISO: string): string {
  const params = new URLSearchParams({ boutiqueId, date: dateISO });
  return `/api/exports/pdf?${params.toString()}`;
}

function RelevesTable({
  rows,
}: {
  readonly rows: readonly RegistreJournalierRow[];
}) {
  if (rows.length === 0) {
    return (
      <p
        role="status"
        className={EMPTY_CLASSES}
        data-testid="registre-detail-releves-empty"
      >
        {NO_RELEVES}
      </p>
    );
  }
  return (
    <div
      className={TABLE_WRAPPER_CLASSES}
      data-testid="registre-detail-releves-wrapper"
    >
      <table
        className={TABLE_CLASSES}
        data-testid="registre-detail-releves-table"
      >
        <thead>
          <tr>
            <th className={TH_CLASSES}>Equipement</th>
            <th className={TH_CLASSES}>Seuils (degC)</th>
            <th className={TH_CLASSES}>{CRENEAU_PDF_LABELS.MATIN}</th>
            <th className={TH_CLASSES}>{CRENEAU_PDF_LABELS.MIDI}</th>
            <th className={TH_CLASSES}>{CRENEAU_PDF_LABELS.SOIR}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.equipementId}>
              <td className={TD_CLASSES}>{row.equipementNom}</td>
              <td className={TD_CLASSES}>
                {row.seuilMin.toFixed(1)} / {row.seuilMax.toFixed(1)}
              </td>
              {row.creneaux.map((cell) => (
                <td key={cell.creneau} className={TD_CLASSES}>
                  {formatTemperature(cell.temperature, '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlerteLine({
  alerte,
}: {
  readonly alerte: RegistreJournalierAlerteEntry;
}) {
  return (
    <li
      className={ALERTE_LINE_CLASSES}
      data-testid={`registre-detail-alerte-${alerte.alerteId}`}
    >
      {alerte.equipementNom} - {CRENEAU_PDF_LABELS[alerte.creneau]} -{' '}
      {alerte.temperature.toFixed(1)} degC (
      {ALERTE_STATUS_PDF_LABELS[alerte.status]})
    </li>
  );
}

function AlertesSection({
  alertes,
}: {
  readonly alertes: readonly RegistreJournalierAlerteEntry[];
}) {
  if (alertes.length === 0) {
    return (
      <p
        role="status"
        className={EMPTY_CLASSES}
        data-testid="registre-detail-alertes-empty"
      >
        {NO_ALERTES}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2" data-testid="registre-detail-alertes">
      {alertes.map((alerte) => (
        <AlerteLine key={alerte.alerteId} alerte={alerte} />
      ))}
    </ul>
  );
}

function RegistreContent({
  data,
  viewer,
  boutiqueId,
  dateISO,
}: {
  readonly data: RegistreJournalier;
  readonly viewer: SessionUser;
  readonly boutiqueId: string;
  readonly dateISO: string;
}) {
  return (
    <section className={SECTION_CLASSES} data-testid="registre-detail-page">
      <AppPageHeader
        eyebrow={HEADER_EYEBROW_PREFIX}
        title={`Registre du ${formatDateShort(dateISO)}`}
        subtitle={data.boutique.nom}
        backHref={RELEVES_PATH}
        backLabel={BACK_LABEL}
        testId="registre-detail-header"
      >
        <a
          href={buildExportPdfHref(boutiqueId, dateISO)}
          className={EXPORT_LINK_CLASSES}
          data-testid="registre-detail-export-pdf"
        >
          {EXPORT_BUTTON_LABEL}
        </a>
      </AppPageHeader>
      <div className={`${STACK_CLASSES} mt-10`}>
        <div className={SUBSECTION_CLASSES}>
          <h2 className={SUBSECTION_TITLE_CLASSES}>{TABLE_TITLE}</h2>
          <RelevesTable rows={data.equipements} />
        </div>
        <div className={SUBSECTION_CLASSES}>
          <h2 className={SUBSECTION_TITLE_CLASSES}>{ALERTES_TITLE}</h2>
          <AlertesSection alertes={data.alertes} />
        </div>
        <SignatureSection
          boutiqueId={boutiqueId}
          dateISO={dateISO}
          viewer={viewer}
          testId="registre-detail-signature"
        />
      </div>
    </section>
  );
}

export default async function RegistreDetailPage({
  params,
}: RegistreDetailPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  const viewer: SessionUser = {
    id: session.user.id,
    role: session.user.role,
  };
  const { boutiqueId, dateISO } = await params;
  const performedByName = session.user.name ?? session.user.email ?? 'user';
  const result = await readRegistreJournalier({
    viewer,
    query: { boutiqueId, date: dateISO },
    performedByName,
    performedByRole: session.user.role,
  });
  if (!result.success) {
    notFound();
  }
  return (
    <main className="min-h-screen bg-mg-ivoire">
      <RegistreContent
        data={result.data}
        viewer={viewer}
        boutiqueId={boutiqueId}
        dateISO={dateISO}
      />
    </main>
  );
}
