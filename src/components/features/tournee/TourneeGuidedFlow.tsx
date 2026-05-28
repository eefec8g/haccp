'use client';

import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import type { Creneau } from '@prisma/client';
import { tourneeSaisieAction } from '@/app/actions/tournee-saisie';
import {
  INITIAL_TOURNEE_SAISIE_STATE,
  type TourneeSaisieActionState,
  type TourneeSaisieFieldErrors,
} from '@/app/actions/tournee-saisie.types';
import { tourneeCorrigeAction } from '@/app/actions/tournee-correction';
import {
  INITIAL_TOURNEE_CORRECTION_STATE,
  type TourneeCorrectionActionState,
  type TourneeCorrectionFieldErrors,
} from '@/app/actions/tournee-correction.types';
import { signatureUploadAction } from '@/app/actions/signature';
import {
  INITIAL_SIGNATURE_UPLOAD_STATE,
  type SignatureUploadActionState,
} from '@/app/actions/signature.types';
import {
  COMMENTAIRE_MIN_CHARS,
  CRENEAU_LABELS,
  TEMPERATURE_MAX,
  TEMPERATURE_MIN,
} from '@/lib/constants/releve';
import { USER_ROLE_LABELS } from '@/lib/constants/user-labels';
import { buildRateLimitMessage } from '@/lib/utils/rate-limit-message';
import { resolveSignatureErrorMessage } from '@/lib/utils/signature-error-messages';
import { formatTemperature } from '@/lib/utils/format-temperature';
import { formatDateShort, formatTimeShort } from '@/lib/utils/dates';
import { MG_EYEBROW_CLASSES } from '@/lib/constants/styles';
import {
  ERROR_BOX_CLASSES,
  INPUT_LARGE_CLASSES,
  SUBMIT_LARGE_CLASSES,
  TEXTAREA_CLASSES,
} from '@/components/features/ui/form-styles';
import { SignaturePad } from '@/components/features/signature/SignaturePad';
import { ResponsiveDataTable } from '@/components/features/admin/ResponsiveDataTable';
import type { AdminDataTableColumn } from '@/components/features/admin/AdminDataTable';
import type {
  TourneeEquipement,
  TourneeReleve,
  TourneeSignature,
} from '@/types/tournee';

/**
 * Flow guide de tournee (feat/tournee-guidee).
 *
 * Le salarie clique "Tournee matin/midi/soir" sur le dashboard et est
 * guide equipement par equipement, sans aucun clic superflu :
 *   - Step `< equipements.length` : saisie inline. Les equipements DEJA
 *     saisis sur ce creneau sont SKIPPES automatiquement (pas d'ecran de
 *     lecture seule a confirmer -> fini le "double clic").
 *   - Step `=== equipements.length` : RECAP de toutes les saisies, avec
 *     un bouton "Modifier" par ligne et un bouton "Signer la tournee".
 *   - Step `=== equipements.length + 1` : ecran signature OBLIGATOIRE
 *     (canvas + upload). Apres signature, retour dashboard.
 *
 * Decisions metier (validees user) :
 *   - Signature finale obligatoire (pas de skip).
 *   - Equipements deja saisis : SKIPPES automatiquement (UX fluide).
 *   - Apres saisie ok : auto-advance vers le prochain manquant, ou recap.
 *   - Recap final listant toutes les saisies avant la signature.
 *
 * Architecture interne :
 *   - 1 seul `'use client'` (toute l'interactivite ici).
 *   - useActionState pour la saisie ET pour la signature.
 *   - localReleves stocke en memoire les releves saisis pendant la
 *     session (les props.releves ne changent pas car le RSC ne se
 *     re-render pas sans navigation).
 *   - stepIndex initial calcule paresseusement = premier equipement
 *     manquant (ou recap si tout est deja saisi).
 *
 * a11y :
 *   - `aria-live="polite"` sur le compteur de progression.
 *   - `aria-label` clair sur chaque step "Equipement X sur Y".
 *   - Focus auto sur l'input temperature au montage de chaque step.
 *   - `min-h-touch` sur tous les boutons interactifs.
 */

const VALIDATION_MESSAGE = 'Veuillez corriger les champs en erreur.';
const FORBIDDEN_MESSAGE =
  "Vous n'etes pas autorise a saisir un releve sur cet equipement.";
const EQUIPEMENT_NOT_FOUND_MESSAGE = 'Equipement introuvable.';
const EQUIPEMENT_INACTIVE_MESSAGE = 'Cet equipement est desactive.';
const ALREADY_EXISTS_MESSAGE =
  'Un releve existe deja pour ce creneau. Passez au suivant.';
const COMMENTAIRE_REQUIRED_MESSAGE =
  'Le commentaire est obligatoire pour une temperature hors seuils.';
const GENERIC_ERROR_MESSAGE =
  'Une erreur est survenue. Merci de reessayer dans quelques instants.';
const CORRECTION_NOT_FOUND_MESSAGE = 'Releve introuvable.';
const CORRECTION_FORBIDDEN_MESSAGE =
  'Vous ne pouvez corriger que vos propres releves.';
const CORRECTION_NOT_TODAY_MESSAGE =
  'Seul un releve du jour peut etre corrige ici.';
const CORRECTION_CRENEAU_MISMATCH_MESSAGE =
  'Ce releve ne correspond pas a cet equipement ou ce creneau.';
const CORRECTION_ALREADY_CANCELLED_MESSAGE = 'Ce releve est deja annule.';
const CORRECTION_SIGNED_MESSAGE =
  'La tournee est deja signee : correction impossible.';

const TEMPERATURE_INPUT_CLASSES = `${INPUT_LARGE_CLASSES} text-center text-3xl font-light tracking-wider`;
const ALERTE_HINT_CLASSES =
  'border-l-2 border-mg-or bg-mg-or/5 px-4 py-3 text-xs font-medium uppercase tracking-[0.15em] text-mg-or';
const SUMMARY_CARD_CLASSES =
  'border border-mg-noir/10 bg-white px-6 py-5 flex flex-col gap-1';
const PROGRESS_CLASSES =
  'text-[10px] font-medium uppercase tracking-[0.3em] text-mg-or';
const SIGNATURE_FRAME_CLASSES =
  'flex flex-col gap-4 border border-mg-noir/10 bg-mg-ivoire/40 p-5';
const RECAP_FRAME_CLASSES = 'flex flex-col gap-5';
const RECAP_SUBTITLE_CLASSES =
  'text-[11px] uppercase tracking-[0.2em] text-mg-noir/50';
const RECAP_MODIFIER_CLASSES =
  'inline-flex min-h-touch items-center justify-center border border-mg-noir/20 bg-transparent px-5 text-[10px] font-medium uppercase tracking-[0.3em] text-mg-noir transition-colors hover:border-mg-or hover:text-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';
const RECAP_STATUS_OK_CLASSES =
  'inline-flex w-fit border border-mg-or/40 bg-transparent px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-mg-or';
const RECAP_STATUS_ALERTE_CLASSES =
  'inline-flex w-fit border border-mg-or bg-mg-or px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-mg-noir';
const RECAP_TEMPERATURE_CLASSES =
  'font-light tracking-wider text-mg-noir tabular-nums';
const SIGNED_BANNER_CLASSES =
  'flex flex-col gap-1 border-l-2 border-mg-or bg-mg-or/5 px-5 py-4';
const SIGNED_BANNER_EYEBROW_CLASSES =
  'text-[10px] font-medium uppercase tracking-[0.3em] text-mg-or';
const SIGNED_BANNER_TEXT_CLASSES = 'text-sm font-light text-mg-noir';
const SIGNED_BANNER_VALUE_CLASSES = 'font-medium text-mg-noir';
const CANCEL_BUTTON_CLASSES =
  'inline-flex min-h-touch items-center justify-center border border-mg-noir/20 bg-transparent px-5 text-[11px] font-medium uppercase tracking-[0.25em] text-mg-noir/70 transition-colors hover:border-mg-noir hover:text-mg-noir focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';

const DASHBOARD_PATH = '/dashboard';

function deriveSaisieError(state: TourneeSaisieActionState): string | null {
  if (state.status !== 'error') {
    return null;
  }
  return mapSaisieErrorCode(state);
}

function mapSaisieErrorCode(
  state: Extract<TourneeSaisieActionState, { status: 'error' }>
): string {
  switch (state.code) {
    case 'VALIDATION':
      return VALIDATION_MESSAGE;
    case 'RATE_LIMITED':
      return buildRateLimitMessage(state.retryAfterSeconds ?? 0);
    case 'FORBIDDEN':
    case 'BOUTIQUE_FORBIDDEN':
      return FORBIDDEN_MESSAGE;
    case 'EQUIPEMENT_NOT_FOUND':
      return EQUIPEMENT_NOT_FOUND_MESSAGE;
    case 'EQUIPEMENT_INACTIVE':
      return EQUIPEMENT_INACTIVE_MESSAGE;
    case 'ALREADY_EXISTS':
      return ALREADY_EXISTS_MESSAGE;
    case 'COMMENTAIRE_REQUIRED':
      return COMMENTAIRE_REQUIRED_MESSAGE;
    default:
      return GENERIC_ERROR_MESSAGE;
  }
}

function firstFieldError(
  fieldErrors: TourneeSaisieFieldErrors | undefined,
  key: keyof TourneeSaisieFieldErrors
): string | undefined {
  return fieldErrors?.[key]?.[0];
}

function deriveCorrectionError(
  state: TourneeCorrectionActionState
): string | null {
  if (state.status !== 'error') {
    return null;
  }
  return mapCorrectionErrorCode(state);
}

function mapCorrectionErrorCode(
  state: Extract<TourneeCorrectionActionState, { status: 'error' }>
): string {
  switch (state.code) {
    case 'VALIDATION':
      return VALIDATION_MESSAGE;
    case 'RATE_LIMITED':
      return buildRateLimitMessage(state.retryAfterSeconds ?? 0);
    case 'NOT_FOUND':
      return CORRECTION_NOT_FOUND_MESSAGE;
    case 'FORBIDDEN':
      return CORRECTION_FORBIDDEN_MESSAGE;
    case 'NOT_TODAY':
      return CORRECTION_NOT_TODAY_MESSAGE;
    case 'CRENEAU_MISMATCH':
      return CORRECTION_CRENEAU_MISMATCH_MESSAGE;
    case 'ALREADY_CANCELLED':
      return CORRECTION_ALREADY_CANCELLED_MESSAGE;
    case 'TOURNEE_DEJA_SIGNEE':
      return CORRECTION_SIGNED_MESSAGE;
    case 'COMMENTAIRE_REQUIRED':
      return COMMENTAIRE_REQUIRED_MESSAGE;
    default:
      return GENERIC_ERROR_MESSAGE;
  }
}

function correctionFieldError(
  fieldErrors: TourneeCorrectionFieldErrors | undefined,
  key: keyof TourneeCorrectionFieldErrors
): string | undefined {
  return fieldErrors?.[key]?.[0];
}

function parseTemperatureInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function isHorsSeuils(
  value: number | null,
  seuilMin: number,
  seuilMax: number
): boolean {
  if (value === null) {
    return false;
  }
  return value < seuilMin || value > seuilMax;
}

type TourneePhase = 'SAISIE' | 'RECAP' | 'CORRECTION' | 'SIGNATURE';

interface ProgressIndicatorProps {
  readonly phase: TourneePhase;
  readonly stepIndex: number;
  readonly total: number;
  readonly equipementNom: string | null;
}

function buildProgressLabel({
  phase,
  stepIndex,
  total,
  equipementNom,
}: ProgressIndicatorProps): string {
  if (phase === 'CORRECTION') {
    return `Correction - ${equipementNom ?? ''}`;
  }
  if (phase === 'RECAP') {
    return `Recapitulatif - ${total} sur ${total}`;
  }
  if (phase === 'SIGNATURE') {
    return `Signature - ${total} sur ${total}`;
  }
  return `Equipement ${stepIndex + 1} sur ${total} - ${equipementNom ?? ''}`;
}

function ProgressIndicator(props: ProgressIndicatorProps) {
  return (
    <p
      className={PROGRESS_CLASSES}
      data-testid="tournee-step-counter"
      role="status"
      aria-live="polite"
    >
      {buildProgressLabel(props)}
    </p>
  );
}

interface SaisieStepProps {
  readonly equipement: TourneeEquipement;
  readonly creneau: Creneau;
  readonly onSubmitted: (releve: TourneeReleve) => void;
}

function SaisieStep({ equipement, creneau, onSubmitted }: SaisieStepProps) {
  const [state, formAction, isPending] = useActionState(
    tourneeSaisieAction,
    INITIAL_TOURNEE_SAISIE_STATE
  );
  const [temperatureRaw, setTemperatureRaw] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const globalErrorId = useId();

  // Focus auto sur l'input temperature au montage du step (a11y +
  // saisie ultra-rapide tactile en boutique).
  useEffect(() => {
    inputRef.current?.focus();
  }, [equipement.id]);

  // Reset des champs en cas de changement d'equipement (re-mount par cle).
  useEffect(() => {
    setTemperatureRaw('');
    setCommentaire('');
  }, [equipement.id]);

  // Auto-advance apres succes.
  useEffect(() => {
    if (state.status === 'success' && state.equipementId === equipement.id) {
      onSubmitted({
        id: state.releve.id,
        temperature: state.releve.temperature,
        alerteHorsSeuils: state.releve.alerteHorsSeuils,
        saisiAt: new Date(state.releve.saisiAt),
      });
    }
  }, [state, equipement.id, onSubmitted]);

  const globalError = deriveSaisieError(state);
  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;
  const temperatureError = firstFieldError(fieldErrors, 'temperature');
  const commentaireError = firstFieldError(fieldErrors, 'commentaire');
  const temperatureValue = parseTemperatureInput(temperatureRaw);
  const horsSeuilsClient = isHorsSeuils(
    temperatureValue,
    equipement.seuilMin,
    equipement.seuilMax
  );
  const commentaireTooShort =
    horsSeuilsClient && commentaire.trim().length < COMMENTAIRE_MIN_CHARS;
  const submitDisabled =
    isPending || temperatureValue === null || commentaireTooShort;

  return (
    <form
      action={formAction}
      aria-label={`Saisie releve ${equipement.nom} ${CRENEAU_LABELS[creneau]}`}
      className="flex flex-col gap-5"
      data-testid="tournee-saisie-form"
      noValidate
    >
      <input type="hidden" name="equipementId" value={equipement.id} />
      <input type="hidden" name="creneau" value={creneau} />

      <section
        className={SUMMARY_CARD_CLASSES}
        data-testid="tournee-saisie-summary"
      >
        <p className={MG_EYEBROW_CLASSES}>{CRENEAU_LABELS[creneau]}</p>
        <h2 className="text-xl font-light tracking-wide text-mg-noir">
          {equipement.nom}
        </h2>
        <p className="text-[11px] uppercase tracking-[0.2em] text-mg-noir/50">
          Seuils {equipement.seuilMin.toFixed(1)} /{' '}
          {equipement.seuilMax.toFixed(1)} degC
        </p>
      </section>

      <label className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-mg-noir/70">
          Temperature (degC)
        </span>
        <input
          ref={inputRef}
          id={`temperature-${equipement.id}`}
          name="temperature"
          type="number"
          step="0.1"
          min={TEMPERATURE_MIN}
          max={TEMPERATURE_MAX}
          required
          inputMode="decimal"
          value={temperatureRaw}
          onChange={(event) => setTemperatureRaw(event.target.value)}
          aria-invalid={!!temperatureError}
          aria-describedby={
            temperatureError ? `temperature-error-${equipement.id}` : undefined
          }
          className={TEMPERATURE_INPUT_CLASSES}
          data-testid="tournee-saisie-temperature"
        />
        {temperatureError ? (
          <span
            id={`temperature-error-${equipement.id}`}
            role="alert"
            aria-live="polite"
            className="text-xs text-mg-or"
          >
            {temperatureError}
          </span>
        ) : null}
      </label>

      {horsSeuilsClient ? (
        <p
          className={ALERTE_HINT_CLASSES}
          role="status"
          aria-live="polite"
          data-testid="tournee-saisie-alerte-hint"
        >
          Temperature hors seuils &middot; commentaire obligatoire (min{' '}
          {COMMENTAIRE_MIN_CHARS} caracteres)
        </p>
      ) : null}

      <label className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-mg-noir/70">
          Commentaire {horsSeuilsClient ? '(obligatoire)' : '(optionnel)'}
        </span>
        <textarea
          id={`commentaire-${equipement.id}`}
          name="commentaire"
          rows={3}
          required={horsSeuilsClient}
          value={commentaire}
          onChange={(event) => setCommentaire(event.target.value)}
          aria-invalid={!!commentaireError}
          className={TEXTAREA_CLASSES}
          data-testid="tournee-saisie-commentaire"
        />
        {commentaireError ? (
          <span role="alert" aria-live="polite" className="text-xs text-mg-or">
            {commentaireError}
          </span>
        ) : null}
      </label>

      <div
        id={globalErrorId}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className={globalError ? ERROR_BOX_CLASSES : 'sr-only'}
        data-testid="tournee-saisie-error"
      >
        {globalError}
      </div>

      <button
        type="submit"
        disabled={submitDisabled}
        aria-busy={isPending}
        className={SUBMIT_LARGE_CLASSES}
        data-testid="tournee-saisie-submit"
      >
        {isPending ? 'Enregistrement...' : 'Enregistrer et continuer'}
      </button>
    </form>
  );
}

export interface CorrectionStepProps {
  readonly equipement: TourneeEquipement;
  readonly creneau: Creneau;
  readonly releve: TourneeReleve;
  readonly onCorrected: (releve: TourneeReleve) => void;
  readonly onCancel: () => void;
}

/**
 * Step de CORRECTION inline d'un releve depuis le recap
 * (fix/signature-action-context).
 *
 * Distinct de `SaisieStep` (SRP) : utilise `tourneeCorrigeAction` (et non
 * `tourneeSaisieAction`), pre-remplit l'input avec la valeur actuelle, et
 * apres succes REVIENT au recap (via `onCorrected`) au lieu d'avancer vers
 * le prochain manquant. Le motif d'annulation est auto-genere cote service
 * (le salarie n'a rien a saisir de plus que la nouvelle valeur).
 *
 * Exporte pour permettre un test SSR cible (rendu pre-rempli + indication
 * "Correction de ..."), la sous-phase n'etant pas atteignable via
 * `renderToStaticMarkup` sur le flow complet (etat interne).
 */
export function CorrectionStep({
  equipement,
  creneau,
  releve,
  onCorrected,
  onCancel,
}: CorrectionStepProps) {
  const [state, formAction, isPending] = useActionState(
    tourneeCorrigeAction,
    INITIAL_TOURNEE_CORRECTION_STATE
  );
  const [temperatureRaw, setTemperatureRaw] = useState(() =>
    String(releve.temperature)
  );
  const [commentaire, setCommentaire] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const globalErrorId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [equipement.id]);

  useEffect(() => {
    if (state.status === 'success' && state.equipementId === equipement.id) {
      onCorrected({
        id: state.releve.id,
        temperature: state.releve.temperature,
        alerteHorsSeuils: state.releve.alerteHorsSeuils,
        saisiAt: new Date(state.releve.saisiAt),
      });
    }
  }, [state, equipement.id, onCorrected]);

  const globalError = deriveCorrectionError(state);
  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;
  const temperatureError = correctionFieldError(fieldErrors, 'temperature');
  const commentaireError = correctionFieldError(fieldErrors, 'commentaire');
  const temperatureValue = parseTemperatureInput(temperatureRaw);
  const horsSeuilsClient = isHorsSeuils(
    temperatureValue,
    equipement.seuilMin,
    equipement.seuilMax
  );
  const commentaireTooShort =
    horsSeuilsClient && commentaire.trim().length < COMMENTAIRE_MIN_CHARS;
  const submitDisabled =
    isPending || temperatureValue === null || commentaireTooShort;

  return (
    <form
      action={formAction}
      aria-label={`Correction du releve ${equipement.nom} ${CRENEAU_LABELS[creneau]}`}
      className="flex flex-col gap-5"
      data-testid="tournee-correction-form"
      noValidate
    >
      <input type="hidden" name="releveId" value={releve.id} />
      <input type="hidden" name="equipementId" value={equipement.id} />
      <input type="hidden" name="creneau" value={creneau} />

      <section
        className={SUMMARY_CARD_CLASSES}
        data-testid="tournee-correction-summary"
      >
        <p
          className={MG_EYEBROW_CLASSES}
          data-testid="tournee-correction-title"
        >
          Correction de {equipement.nom}
        </p>
        <h2 className="text-xl font-light tracking-wide text-mg-noir">
          {equipement.nom}
        </h2>
        <p className="text-[11px] uppercase tracking-[0.2em] text-mg-noir/50">
          Seuils {equipement.seuilMin.toFixed(1)} /{' '}
          {equipement.seuilMax.toFixed(1)} degC
        </p>
      </section>

      <label className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-mg-noir/70">
          Temperature (degC)
        </span>
        <input
          ref={inputRef}
          id={`correction-temperature-${equipement.id}`}
          name="temperature"
          type="number"
          step="0.1"
          min={TEMPERATURE_MIN}
          max={TEMPERATURE_MAX}
          required
          inputMode="decimal"
          value={temperatureRaw}
          onChange={(event) => setTemperatureRaw(event.target.value)}
          aria-invalid={!!temperatureError}
          aria-describedby={
            temperatureError
              ? `correction-temperature-error-${equipement.id}`
              : undefined
          }
          className={TEMPERATURE_INPUT_CLASSES}
          data-testid="tournee-correction-temperature"
        />
        {temperatureError ? (
          <span
            id={`correction-temperature-error-${equipement.id}`}
            role="alert"
            aria-live="polite"
            className="text-xs text-mg-or"
          >
            {temperatureError}
          </span>
        ) : null}
      </label>

      {horsSeuilsClient ? (
        <p
          className={ALERTE_HINT_CLASSES}
          role="status"
          aria-live="polite"
          data-testid="tournee-correction-alerte-hint"
        >
          Temperature hors seuils &middot; commentaire obligatoire (min{' '}
          {COMMENTAIRE_MIN_CHARS} caracteres)
        </p>
      ) : null}

      <label className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-mg-noir/70">
          Commentaire {horsSeuilsClient ? '(obligatoire)' : '(optionnel)'}
        </span>
        <textarea
          id={`correction-commentaire-${equipement.id}`}
          name="commentaire"
          rows={3}
          required={horsSeuilsClient}
          value={commentaire}
          onChange={(event) => setCommentaire(event.target.value)}
          aria-invalid={!!commentaireError}
          className={TEXTAREA_CLASSES}
          data-testid="tournee-correction-commentaire"
        />
        {commentaireError ? (
          <span role="alert" aria-live="polite" className="text-xs text-mg-or">
            {commentaireError}
          </span>
        ) : null}
      </label>

      <div
        id={globalErrorId}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className={globalError ? ERROR_BOX_CLASSES : 'sr-only'}
        data-testid="tournee-correction-error"
      >
        {globalError}
      </div>

      <button
        type="submit"
        disabled={submitDisabled}
        aria-busy={isPending}
        className={SUBMIT_LARGE_CLASSES}
        data-testid="tournee-correction-submit"
      >
        {isPending ? 'Correction...' : 'Corriger et revenir au recap'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className={CANCEL_BUTTON_CLASSES}
        data-testid="tournee-correction-cancel"
      >
        Annuler la correction
      </button>
    </form>
  );
}

interface RecapEntry {
  readonly equipement: TourneeEquipement;
  readonly releve: TourneeReleve;
}

/** Badge de statut OK / Alerte d'une ligne de recap (charte MG). */
function RecapStatusBadge({ entry }: { readonly entry: RecapEntry }) {
  const { equipement, releve } = entry;
  return (
    <span
      className={
        releve.alerteHorsSeuils
          ? RECAP_STATUS_ALERTE_CLASSES
          : RECAP_STATUS_OK_CLASSES
      }
      role="status"
      data-testid={`tournee-recap-status-${equipement.id}`}
    >
      {releve.alerteHorsSeuils ? 'Alerte' : 'OK'}
    </span>
  );
}

/**
 * Bouton "Modifier" d'une ligne de recap.
 *
 * Le bouton ne pointe PLUS vers la page externe `/releves/{id}/annuler`
 * (reservee RESPONSABLE/ADMIN -> 404 pour le salarie). Il rouvre le step
 * de correction inline dans le flow (`onModifier`), permettant a l'auteur
 * de corriger sa propre saisie du jour avant la signature.
 */
function RecapModifierButton({
  entry,
  onModifier,
}: {
  readonly entry: RecapEntry;
  readonly onModifier: (equipementId: string) => void;
}) {
  const { equipement } = entry;
  return (
    <button
      type="button"
      onClick={() => onModifier(equipement.id)}
      className={RECAP_MODIFIER_CLASSES}
      aria-label={`Modifier le releve de ${equipement.nom}`}
      data-testid={`tournee-recap-modifier-${equipement.id}`}
    >
      Modifier
    </button>
  );
}

/**
 * Colonnes du tableau de recap. La colonne "Action" (bouton Modifier)
 * n'est presente QUE si la tournee n'est pas signee : une fois signee,
 * le recap est en lecture seule stricte (tracabilite immuable HACCP).
 */
function buildRecapColumns(
  onModifier: (equipementId: string) => void,
  isLocked: boolean
): readonly AdminDataTableColumn<RecapEntry>[] {
  const baseColumns: readonly AdminDataTableColumn<RecapEntry>[] = [
    {
      key: 'equipement',
      label: 'Equipement',
      render: (entry) => entry.equipement.nom,
    },
    {
      key: 'temperature',
      label: 'Temperature',
      align: 'right',
      render: (entry) => (
        <span className={RECAP_TEMPERATURE_CLASSES}>
          {formatTemperature(entry.releve.temperature)}
        </span>
      ),
    },
    {
      key: 'heure',
      label: 'Heure',
      align: 'right',
      render: (entry) => formatTimeShort(entry.releve.saisiAt),
    },
    {
      key: 'statut',
      label: 'Statut',
      render: (entry) => <RecapStatusBadge entry={entry} />,
    },
  ];
  if (isLocked) {
    return baseColumns;
  }
  return [
    ...baseColumns,
    {
      key: 'action',
      label: 'Action',
      align: 'right',
      render: (entry) => (
        <RecapModifierButton entry={entry} onModifier={onModifier} />
      ),
    },
  ];
}

function recapEntryId(entry: RecapEntry): string {
  return entry.equipement.id;
}

interface SignedBannerProps {
  readonly signature: TourneeSignature;
}

/** Bandeau "Tournee signee le ... a ... par ..." (recap verrouille). */
function SignedBanner({ signature }: SignedBannerProps) {
  const dateShort = formatDateShort(
    signature.signedAt.toISOString().slice(0, 10)
  );
  const heure = formatTimeShort(signature.signedAt);
  const roleLabel = USER_ROLE_LABELS[signature.signataireRoleSnapshot];
  return (
    <div
      className={SIGNED_BANNER_CLASSES}
      role="status"
      data-testid="tournee-recap-signed-banner"
    >
      <p className={SIGNED_BANNER_EYEBROW_CLASSES}>Tournee signee</p>
      <p className={SIGNED_BANNER_TEXT_CLASSES}>
        Signee le{' '}
        <span className={SIGNED_BANNER_VALUE_CLASSES}>{dateShort}</span> a{' '}
        <span className={SIGNED_BANNER_VALUE_CLASSES}>{heure}</span> par{' '}
        <span className={SIGNED_BANNER_VALUE_CLASSES}>
          {signature.signataireNom}
        </span>{' '}
        ({roleLabel}).
      </p>
    </div>
  );
}

interface RecapStepProps {
  readonly creneau: Creneau;
  readonly entries: readonly RecapEntry[];
  readonly signature: TourneeSignature | null;
  readonly onSign: () => void;
  readonly onModifier: (equipementId: string) => void;
  readonly onDone: () => void;
}

/**
 * Step RECAP : tableau lisible (ResponsiveDataTable) des saisies.
 *
 * Verrouillage (decision user) : si `signature` existe, le recap est
 * l'ecran FINAL en lecture seule -> bandeau "Tournee signee", aucune
 * colonne Action (pas de "Modifier"), bouton "Retour au dashboard" a la
 * place de "Signer la tournee". Le SignatureStep n'est jamais atteint
 * quand la tournee est deja signee (pas de re-signature possible).
 */
function RecapStep({
  creneau,
  entries,
  signature,
  onSign,
  onModifier,
  onDone,
}: RecapStepProps) {
  const isLocked = signature !== null;
  const columns = buildRecapColumns(onModifier, isLocked);
  return (
    <section
      className={RECAP_FRAME_CLASSES}
      data-testid="tournee-recap-step"
      aria-label={`Recapitulatif de la tournee ${CRENEAU_LABELS[creneau]}`}
    >
      <header className="flex flex-col gap-1">
        <p className={MG_EYEBROW_CLASSES}>
          {isLocked ? 'Registre signe' : 'Verification finale'}
        </p>
        <h2 className="text-xl font-light tracking-wide text-mg-noir">
          Recapitulatif de votre tournee {CRENEAU_LABELS[creneau]}
        </h2>
        <p className={RECAP_SUBTITLE_CLASSES} data-testid="tournee-recap-count">
          {entries.length} equipement{entries.length > 1 ? 's' : ''} releve
          {entries.length > 1 ? 's' : ''}
        </p>
      </header>
      {signature ? <SignedBanner signature={signature} /> : null}
      <ResponsiveDataTable
        name="tournee-recap"
        columns={columns}
        rows={entries}
        getRowId={recapEntryId}
        caption={`Recapitulatif de la tournee ${CRENEAU_LABELS[creneau]}`}
      />
      {isLocked ? (
        <button
          type="button"
          onClick={onDone}
          className={SUBMIT_LARGE_CLASSES}
          data-testid="tournee-recap-back"
        >
          Retour au dashboard
        </button>
      ) : (
        <button
          type="button"
          onClick={onSign}
          className={SUBMIT_LARGE_CLASSES}
          data-testid="tournee-recap-signer"
        >
          Signer la tournee
        </button>
      )}
    </section>
  );
}

interface SignatureStepProps {
  readonly boutiqueId: string;
  readonly dateISO: string;
  readonly onDone: () => void;
}

function buildSignatureFormData(args: {
  readonly boutiqueId: string;
  readonly dateISO: string;
  readonly blob: Blob;
}): FormData {
  const formData = new FormData();
  formData.set('boutiqueId', args.boutiqueId);
  formData.set('dateISO', args.dateISO);
  formData.set('file', args.blob, 'signature.png');
  return formData;
}

function deriveSignatureError(
  state: SignatureUploadActionState
): string | null {
  if (state.status !== 'error') {
    return null;
  }
  if (state.code === 'RATE_LIMITED') {
    return buildRateLimitMessage(state.retryAfterSeconds ?? 0);
  }
  return resolveSignatureErrorMessage(state.code);
}

/**
 * Step SIGNATURE : canvas + upload de la signature manuscrite.
 *
 * Atteignable UNIQUEMENT depuis le recap NON signe via "Signer la
 * tournee". Le cas "deja signee" est gere en amont par le RECAP
 * verrouille (cf. `RecapStep` + `derivePhase`) : ce composant n'a donc
 * plus a afficher de message "deja signee" (plus de duplication).
 */
function SignatureStep({ boutiqueId, dateISO, onDone }: SignatureStepProps) {
  const [state, formAction, isPending] = useActionState(
    signatureUploadAction,
    INITIAL_SIGNATURE_UPLOAD_STATE
  );
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Apres succes : redirect dashboard via le callback (le parent gere
  // la navigation pour permettre la reutilisation du composant en test).
  useEffect(() => {
    if (state.status === 'success' && hasSubmitted) {
      onDone();
    }
  }, [state, hasSubmitted, onDone]);

  const globalError = deriveSignatureError(state);

  function handleSign(blob: Blob): void {
    setHasSubmitted(true);
    startTransition(() => {
      formAction(buildSignatureFormData({ boutiqueId, dateISO, blob }));
    });
  }

  return (
    <section
      className={SIGNATURE_FRAME_CLASSES}
      data-testid="tournee-signature-step"
      aria-busy={isPending}
      aria-label="Signer la tournee"
    >
      <p className={MG_EYEBROW_CLASSES}>Validation finale obligatoire</p>
      <h2 className="text-xl font-light tracking-wide text-mg-noir">
        Signer la tournee
      </h2>
      <p className="text-[11px] uppercase tracking-[0.2em] text-mg-noir/60">
        Dessinez votre signature pour valider la tournee du jour.
      </p>
      <SignaturePad
        onSign={handleSign}
        disabled={isPending}
        testId="tournee-signature-pad"
      />
      {globalError ? (
        <div
          role="alert"
          aria-live="polite"
          className={ERROR_BOX_CLASSES}
          data-testid="tournee-signature-error"
        >
          {globalError}
        </div>
      ) : null}
    </section>
  );
}

export interface TourneeGuidedFlowProps {
  readonly boutiqueId: string;
  readonly boutiqueNom: string;
  readonly dateISO: string;
  readonly creneau: Creneau;
  readonly equipements: readonly TourneeEquipement[];
  readonly releves: Readonly<Record<string, TourneeReleve | null>>;
  readonly signature: TourneeSignature | null;
}

type ReleveLookup = Readonly<Record<string, TourneeReleve | null>>;
type LocalReleves = Readonly<Record<string, TourneeReleve>>;

/**
 * Resout le releve actif d'un equipement (local prioritaire sur props).
 * Renvoie `null` si l'equipement n'a pas encore ete saisi.
 */
function resolveReleve(
  equipement: TourneeEquipement,
  releves: ReleveLookup,
  localReleves: LocalReleves
): TourneeReleve | null {
  return localReleves[equipement.id] ?? releves[equipement.id] ?? null;
}

/**
 * Index du premier equipement MANQUANT a partir de `fromIndex`.
 * Renvoie `equipements.length` (= step recap) si tout est saisi.
 */
function findNextMissingIndex({
  equipements,
  releves,
  localReleves,
  fromIndex,
}: {
  readonly equipements: readonly TourneeEquipement[];
  readonly releves: ReleveLookup;
  readonly localReleves: LocalReleves;
  readonly fromIndex: number;
}): number {
  for (let index = fromIndex; index < equipements.length; index += 1) {
    const equipement = equipements[index];
    if (
      equipement &&
      resolveReleve(equipement, releves, localReleves) === null
    ) {
      return index;
    }
  }
  return equipements.length;
}

/** Lignes du recap : tous les equipements saisis, dans l'ordre du parc. */
function buildRecapEntries(
  equipements: readonly TourneeEquipement[],
  releves: ReleveLookup,
  localReleves: LocalReleves
): readonly RecapEntry[] {
  return equipements.flatMap((equipement) => {
    const releve = resolveReleve(equipement, releves, localReleves);
    return releve ? [{ equipement, releve }] : [];
  });
}

/**
 * Resout l'entree de correction (equipement + releve actif) pour un
 * equipementId donne. Renvoie `null` si l'equipement n'existe pas ou n'a
 * pas (ou plus) de releve actif a corriger.
 */
function findCorrectionEntry(
  equipementId: string,
  equipements: readonly TourneeEquipement[],
  releves: ReleveLookup,
  localReleves: LocalReleves
): RecapEntry | null {
  const equipement = equipements.find((eq) => eq.id === equipementId);
  if (!equipement) {
    return null;
  }
  const releve = resolveReleve(equipement, releves, localReleves);
  return releve ? { equipement, releve } : null;
}

/**
 * Phase derivee de l'index de step courant.
 *
 * Verrouillage (decision user) : si la tournee est DEJA signee, le flow
 * est fige sur le RECAP en lecture seule, quel que soit l'index. On ne
 * peut atteindre ni SAISIE/CORRECTION (correction interdite apres
 * signature, cf. service), ni SIGNATURE (pas de re-signature).
 */
function derivePhase(
  stepIndex: number,
  totalSteps: number,
  isSigned: boolean
): TourneePhase {
  if (isSigned) {
    return 'RECAP';
  }
  if (stepIndex < totalSteps) {
    return 'SAISIE';
  }
  if (stepIndex === totalSteps) {
    return 'RECAP';
  }
  return 'SIGNATURE';
}

export function TourneeGuidedFlow({
  boutiqueId,
  boutiqueNom,
  dateISO,
  creneau,
  equipements,
  releves,
  signature,
}: TourneeGuidedFlowProps) {
  const router = useRouter();
  const isSigned = signature !== null;
  const totalSteps = equipements.length;
  // Si la tournee est deja signee au chargement, on demarre directement
  // sur le RECAP verrouille (totalSteps) au lieu du premier manquant.
  const [stepIndex, setStepIndex] = useState(() =>
    isSigned
      ? totalSteps
      : findNextMissingIndex({
          equipements,
          releves,
          localReleves: {},
          fromIndex: 0,
        })
  );
  const [localReleves, setLocalReleves] = useState<LocalReleves>({});
  // Equipement en cours de correction depuis le recap (null = pas de
  // correction active). Prioritaire sur la phase derivee du stepIndex :
  // la correction est une "sous-phase" du recap (on y revient apres).
  const [correctionEquipementId, setCorrectionEquipementId] = useState<
    string | null
  >(null);

  // Tournee signee : aucune correction possible (lecture seule stricte).
  const correctionEntry =
    correctionEquipementId && !isSigned
      ? findCorrectionEntry(
          correctionEquipementId,
          equipements,
          releves,
          localReleves
        )
      : null;
  const phase: TourneePhase = correctionEntry
    ? 'CORRECTION'
    : derivePhase(stepIndex, totalSteps, isSigned);
  const activeEquipement =
    phase === 'SAISIE' ? (equipements[stepIndex] ?? null) : null;

  function handleSubmitted(releve: TourneeReleve): void {
    if (!activeEquipement) {
      return;
    }
    const nextLocalReleves: LocalReleves = {
      ...localReleves,
      [activeEquipement.id]: releve,
    };
    setLocalReleves(nextLocalReleves);
    setStepIndex(
      findNextMissingIndex({
        equipements,
        releves,
        localReleves: nextLocalReleves,
        fromIndex: stepIndex + 1,
      })
    );
  }

  function handleModifier(equipementId: string): void {
    setCorrectionEquipementId(equipementId);
  }

  function handleCorrected(equipementId: string, releve: TourneeReleve): void {
    setLocalReleves({ ...localReleves, [equipementId]: releve });
    setCorrectionEquipementId(null);
  }

  function handleCancelCorrection(): void {
    setCorrectionEquipementId(null);
  }

  function handleSign(): void {
    setStepIndex(totalSteps + 1);
  }

  function handleDone(): void {
    router.push(DASHBOARD_PATH);
  }

  if (totalSteps === 0) {
    return (
      <section
        className="flex flex-col gap-4 border border-mg-noir/15 bg-mg-ivoire/40 p-6 text-center"
        data-testid="tournee-flow"
      >
        <p className={MG_EYEBROW_CLASSES}>Tournee impossible</p>
        <p className="text-sm font-light text-mg-noir/70">
          Aucun equipement actif dans cette boutique.
        </p>
      </section>
    );
  }

  // Le RECAP affiche un tableau large (ResponsiveDataTable) qui occupe
  // toute la largeur de la page (max-w-4xl). Les autres etapes (saisie /
  // correction / signature) sont des formulaires mono-colonne recentres
  // a max-w-2xl pour rester lisibles et ne pas etirer les champs.
  const layoutWidthClass =
    phase === 'RECAP' ? 'w-full' : 'mx-auto w-full max-w-2xl';

  return (
    <section
      className={`flex flex-col gap-6 ${layoutWidthClass}`}
      data-testid="tournee-flow"
      aria-label={`Tournee ${CRENEAU_LABELS[creneau]} ${boutiqueNom}`}
    >
      <ProgressIndicator
        phase={phase}
        stepIndex={stepIndex}
        total={totalSteps}
        equipementNom={
          correctionEntry?.equipement.nom ?? activeEquipement?.nom ?? null
        }
      />

      {phase === 'CORRECTION' && correctionEntry ? (
        <CorrectionStep
          key={correctionEntry.equipement.id}
          equipement={correctionEntry.equipement}
          creneau={creneau}
          releve={correctionEntry.releve}
          onCorrected={(releve) =>
            handleCorrected(correctionEntry.equipement.id, releve)
          }
          onCancel={handleCancelCorrection}
        />
      ) : phase === 'SIGNATURE' ? (
        <SignatureStep
          boutiqueId={boutiqueId}
          dateISO={dateISO}
          onDone={handleDone}
        />
      ) : phase === 'RECAP' ? (
        <RecapStep
          creneau={creneau}
          entries={buildRecapEntries(equipements, releves, localReleves)}
          signature={signature}
          onSign={handleSign}
          onModifier={handleModifier}
          onDone={handleDone}
        />
      ) : activeEquipement ? (
        <SaisieStep
          key={activeEquipement.id}
          equipement={activeEquipement}
          creneau={creneau}
          onSubmitted={handleSubmitted}
        />
      ) : null}

      <p className="text-[11px] uppercase tracking-[0.2em] text-mg-noir/40">
        {boutiqueNom} &middot; {formatDateShort(dateISO)}
      </p>
    </section>
  );
}
