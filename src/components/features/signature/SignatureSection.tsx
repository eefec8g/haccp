import type { UserRole } from '@prisma/client';
import { getSignatureForRegistre } from '@/lib/services/signature.service';
import type { SignatureViewer } from '@/types/signature';
import { MG_EYEBROW_CLASSES } from '@/lib/constants/styles';
import { SignatureDisplay } from './SignatureDisplay';
import { SignatureUploadForm } from './SignatureUploadForm';

/**
 * Container "signature" de la page registre journalier (US-SIG-001).
 *
 * Server Component qui orchestre 3 cas :
 *   1. Signature existante (peu importe le viewer) -> `SignatureDisplay`.
 *   2. Pas de signature ET viewer autorise (SALARIE/RESPONSABLE)
 *      -> `SignatureUploadForm` (capture + submit).
 *   3. Pas de signature ET viewer non autorise (ADMIN par exemple)
 *      -> message "En attente de signature" (status visible mais pas
 *      d'action proposee).
 *
 * Centralise les checks "peut signer" pour eviter de dupliquer la regle
 * metier entre la page registre et d'autres futures consommatrices
 * (ex. timeline alerte / export). La whitelist est alignee sur le
 * service `uploadSignatureToRegistre` (decision Phase 0.5 #2).
 *
 * Defensif : si `getSignatureForRegistre` retourne une erreur (scope
 * hors perimetre par exemple), on rend le message en attente plutot
 * que de leaker une erreur. Le scope check est deja effectue par la
 * page parente avant le render.
 */

const SECTION_CLASSES = 'flex flex-col gap-4';
const HEADER_CLASSES = 'flex flex-col gap-1';
const TITLE_CLASSES =
  'text-lg font-light uppercase tracking-[0.2em] text-mg-noir';
const EMPTY_CLASSES =
  'border border-dashed border-mg-noir/15 bg-mg-ivoire/40 px-5 py-8 text-center text-sm font-light text-mg-noir/60';

const HEADER_EYEBROW = 'Maison Givre - Validation HACCP';
const HEADER_TITLE = 'Signature du registre';
const EMPTY_MESSAGE = 'Registre en attente de signature.';

const SIGNATURE_ALLOWED_ROLES: readonly UserRole[] = ['SALARIE', 'RESPONSABLE'];

function canSignRegistre(role: UserRole): boolean {
  return SIGNATURE_ALLOWED_ROLES.includes(role);
}

export interface SignatureSectionProps {
  readonly boutiqueId: string;
  readonly dateISO: string;
  readonly viewer: SignatureViewer;
  readonly testId?: string;
}

export async function SignatureSection({
  boutiqueId,
  dateISO,
  viewer,
  testId,
}: SignatureSectionProps) {
  const resolvedTestId = testId ?? 'signature-section';
  const result = await getSignatureForRegistre({ viewer, boutiqueId, dateISO });
  const signature = result.success ? result.data : null;
  const allowedToSign = canSignRegistre(viewer.role);

  return (
    <section
      aria-label={HEADER_TITLE}
      className={SECTION_CLASSES}
      data-testid={resolvedTestId}
    >
      <header className={HEADER_CLASSES}>
        <p className={MG_EYEBROW_CLASSES}>{HEADER_EYEBROW}</p>
        <h2 className={TITLE_CLASSES}>{HEADER_TITLE}</h2>
      </header>

      {signature ? (
        <SignatureDisplay
          signature={signature}
          testId={`${resolvedTestId}-display`}
        />
      ) : allowedToSign ? (
        <SignatureUploadForm
          boutiqueId={boutiqueId}
          dateISO={dateISO}
          testId={`${resolvedTestId}-form`}
        />
      ) : (
        <p
          role="status"
          aria-live="polite"
          className={EMPTY_CLASSES}
          data-testid={`${resolvedTestId}-empty`}
        >
          {EMPTY_MESSAGE}
        </p>
      )}
    </section>
  );
}
