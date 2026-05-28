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
import { buildRateLimitMessage } from '@/lib/utils/rate-limit-message';
import { resolveSignatureErrorMessage } from '@/lib/utils/signature-error-messages';
import { formatTemperature } from '@/lib/utils/format-temperature';
import { formatDateShort, formatTimeShort } from '@/lib/utils/dates';
import {
  MG_EYEBROW_CLASSES,
  MG_GHOST_BUTTON_CLASSES,
} from '@/lib/constants/styles';
import {
  ERROR_BOX_CLASSES,
  INPUT_LARGE_CLASSES,
  SUBMIT_LARGE_CLASSES,
  TEXTAREA_CLASSES,
} from '@/components/features/ui/form-styles';
import { SignaturePad } from '@/components/features/signature/SignaturePad';
import type {
  TourneeEquipement,
  TourneeReleve,
  TourneeSignature,
} from '@/types/tournee';

/**
 * Flow guide de tournee (feat/tournee-guidee).
 *
 * Le salarie clique "Tournee matin/midi/soir" sur le dashboard et est
 * guide equipement par equipement :
 *   - Step `< equipements.length` : saisie inline (ou lecture seule si
 *     deja saisi sur ce creneau, avec bouton "Suivant").
 *   - Step `=== equipements.length` : ecran signature OBLIGATOIRE
 *     (canvas + upload). Apres signature, retour dashboard.
 *
 * Decisions metier (validees user) :
 *   - Signature finale obligatoire (pas de skip).
 *   - Equipements deja saisis : affiches en lecture seule (pas auto-skip).
 *   - Apres saisie ok : auto-advance step++.
 *   - Boutons Precedent / Suivant pour naviguer dans la tournee.
 *
 * Architecture interne :
 *   - 1 seul `'use client'` (toute l'interactivite ici).
 *   - useActionState pour la saisie ET pour la signature.
 *   - localReleves stocke en memoire les releves saisis pendant la
 *     session (les props.releves ne changent pas car le RSC ne se
 *     re-render pas sans navigation).
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

const TEMPERATURE_INPUT_CLASSES = `${INPUT_LARGE_CLASSES} text-center text-3xl font-light tracking-wider`;
const NEXT_BUTTON_CLASSES = `${SUBMIT_LARGE_CLASSES}`;
const ALERTE_HINT_CLASSES =
  'border-l-2 border-mg-or bg-mg-or/5 px-4 py-3 text-xs font-medium uppercase tracking-[0.15em] text-mg-or';
const READONLY_CARD_CLASSES =
  'flex flex-col gap-3 border border-mg-noir/10 bg-white p-6';
const SUMMARY_CARD_CLASSES =
  'border border-mg-noir/10 bg-white px-6 py-5 flex flex-col gap-1';
const PROGRESS_CLASSES =
  'text-[10px] font-medium uppercase tracking-[0.3em] text-mg-or';
const ACTIONS_ROW_CLASSES = 'flex flex-wrap items-center justify-between gap-3';
const SIGNATURE_FRAME_CLASSES =
  'flex flex-col gap-4 border border-mg-noir/10 bg-mg-ivoire/40 p-5';
const SIGNATURE_NOTICE_CLASSES =
  'border border-mg-noir/15 bg-mg-ivoire px-4 py-3 text-xs font-light uppercase tracking-[0.15em] text-mg-noir';

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

interface ProgressIndicatorProps {
  readonly stepIndex: number;
  readonly total: number;
  readonly equipementNom: string | null;
}

function ProgressIndicator({
  stepIndex,
  total,
  equipementNom,
}: ProgressIndicatorProps) {
  const label =
    equipementNom !== null
      ? `Equipement ${stepIndex + 1} sur ${total} - ${equipementNom}`
      : `Signature - ${total} sur ${total}`;
  return (
    <p
      className={PROGRESS_CLASSES}
      data-testid="tournee-step-counter"
      role="status"
      aria-live="polite"
    >
      {label}
    </p>
  );
}

interface NavigationButtonsProps {
  readonly canGoPrevious: boolean;
  readonly canGoNext: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly nextLabel?: string;
}

function NavigationButtons({
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  nextLabel,
}: NavigationButtonsProps) {
  return (
    <div className={ACTIONS_ROW_CLASSES}>
      <button
        type="button"
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className={MG_GHOST_BUTTON_CLASSES}
        data-testid="tournee-previous"
      >
        Precedent
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        className={NEXT_BUTTON_CLASSES}
        data-testid="tournee-next"
      >
        {nextLabel ?? 'Suivant'}
      </button>
    </div>
  );
}

interface ReadOnlyStepProps {
  readonly equipement: TourneeEquipement;
  readonly releve: TourneeReleve;
}

function ReadOnlyStep({ equipement, releve }: ReadOnlyStepProps) {
  const statusLabel = releve.alerteHorsSeuils ? 'Alerte' : 'Saisi';
  const heureLabel = formatTimeShort(releve.saisiAt);
  return (
    <div
      className={READONLY_CARD_CLASSES}
      data-testid={`tournee-cell-${equipement.id}`}
    >
      <p className={MG_EYEBROW_CLASSES}>Deja saisi</p>
      <h2 className="text-xl font-light tracking-wide text-mg-noir">
        {equipement.nom}
      </h2>
      <p className="text-[11px] uppercase tracking-[0.2em] text-mg-noir/60">
        Seuils {equipement.seuilMin.toFixed(1)} /{' '}
        {equipement.seuilMax.toFixed(1)} degC
      </p>
      <p
        className="text-3xl font-light tracking-wider text-mg-noir"
        data-testid={`tournee-cell-${equipement.id}-temperature`}
      >
        {formatTemperature(releve.temperature)}
      </p>
      <p
        className="text-[10px] tracking-wide text-mg-noir/50"
        data-testid={`tournee-cell-${equipement.id}-time`}
      >
        Saisi a {heureLabel}
      </p>
      <p
        className={
          releve.alerteHorsSeuils
            ? 'inline-flex w-fit border border-mg-or bg-mg-or px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-mg-noir'
            : 'inline-flex w-fit border border-mg-or/40 bg-transparent px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-mg-or'
        }
        role="status"
        data-testid={`tournee-cell-${equipement.id}-status`}
      >
        {statusLabel}
      </p>
    </div>
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

interface SignatureStepProps {
  readonly boutiqueId: string;
  readonly dateISO: string;
  readonly signature: TourneeSignature | null;
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

function SignatureStep({
  boutiqueId,
  dateISO,
  signature,
  onDone,
}: SignatureStepProps) {
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

  if (signature) {
    const dateShort = formatDateShort(
      signature.signedAt.toISOString().slice(0, 10)
    );
    return (
      <section
        className={SIGNATURE_FRAME_CLASSES}
        data-testid="tournee-signature-step"
        aria-label="Tournee deja signee"
      >
        <p className={MG_EYEBROW_CLASSES}>Registre signe</p>
        <h2 className="text-xl font-light tracking-wide text-mg-noir">
          Tournee deja validee
        </h2>
        <p
          className={SIGNATURE_NOTICE_CLASSES}
          data-testid="tournee-signature-already"
        >
          Signee par {signature.signataireNom} le {dateShort}.
        </p>
        <button
          type="button"
          onClick={onDone}
          className={SUBMIT_LARGE_CLASSES}
          data-testid="tournee-signature-back"
        >
          Retour au dashboard
        </button>
      </section>
    );
  }

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

interface ResolvedReleve {
  readonly equipement: TourneeEquipement;
  readonly releve: TourneeReleve | null;
}

function resolveStep({
  equipements,
  stepIndex,
  releves,
  localReleves,
}: {
  readonly equipements: readonly TourneeEquipement[];
  readonly stepIndex: number;
  readonly releves: Readonly<Record<string, TourneeReleve | null>>;
  readonly localReleves: Readonly<Record<string, TourneeReleve>>;
}): ResolvedReleve | null {
  const equipement = equipements[stepIndex];
  if (!equipement) {
    return null;
  }
  const local = localReleves[equipement.id];
  if (local) {
    return { equipement, releve: local };
  }
  return { equipement, releve: releves[equipement.id] ?? null };
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
  const totalSteps = equipements.length;
  const [stepIndex, setStepIndex] = useState(0);
  const [localReleves, setLocalReleves] = useState<
    Readonly<Record<string, TourneeReleve>>
  >({});

  const resolved = resolveStep({
    equipements,
    stepIndex,
    releves,
    localReleves,
  });
  const isSignatureStep = stepIndex >= totalSteps;
  const canGoPrevious = stepIndex > 0;
  const canGoNext = stepIndex < totalSteps;

  function handlePrevious(): void {
    setStepIndex((value) => Math.max(0, value - 1));
  }

  function handleNext(): void {
    setStepIndex((value) => Math.min(totalSteps, value + 1));
  }

  function handleSubmitted(releve: TourneeReleve): void {
    if (!resolved) {
      return;
    }
    setLocalReleves((current) => ({
      ...current,
      [resolved.equipement.id]: releve,
    }));
    setStepIndex((value) => Math.min(totalSteps, value + 1));
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

  return (
    <section
      className="flex flex-col gap-6"
      data-testid="tournee-flow"
      aria-label={`Tournee ${CRENEAU_LABELS[creneau]} ${boutiqueNom}`}
    >
      <ProgressIndicator
        stepIndex={isSignatureStep ? totalSteps - 1 : stepIndex}
        total={totalSteps}
        equipementNom={
          isSignatureStep ? null : (resolved?.equipement.nom ?? null)
        }
      />

      {isSignatureStep ? (
        <SignatureStep
          boutiqueId={boutiqueId}
          dateISO={dateISO}
          signature={signature}
          onDone={handleDone}
        />
      ) : resolved && resolved.releve ? (
        <>
          <ReadOnlyStep
            equipement={resolved.equipement}
            releve={resolved.releve}
          />
          <NavigationButtons
            canGoPrevious={canGoPrevious}
            canGoNext={canGoNext}
            onPrevious={handlePrevious}
            onNext={handleNext}
          />
        </>
      ) : resolved ? (
        <>
          <SaisieStep
            key={resolved.equipement.id}
            equipement={resolved.equipement}
            creneau={creneau}
            onSubmitted={handleSubmitted}
          />
          {canGoPrevious ? (
            <div className={ACTIONS_ROW_CLASSES}>
              <button
                type="button"
                onClick={handlePrevious}
                className={MG_GHOST_BUTTON_CLASSES}
                data-testid="tournee-previous"
              >
                Precedent
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <p className="text-[11px] uppercase tracking-[0.2em] text-mg-noir/40">
        {boutiqueNom} &middot; {formatDateShort(dateISO)}
      </p>
    </section>
  );
}
