import type { ReactNode } from 'react';

interface FormFieldProps {
  readonly label: string;
  readonly name: string;
  readonly error?: string | null;
  readonly hint?: string | null;
  readonly required?: boolean;
  readonly children: ReactNode;
}

const LABEL_CLASSES =
  'mb-2 block text-[10px] font-medium uppercase tracking-[0.25em] text-mg-noir/70';
const ERROR_CLASSES = 'mt-2 text-xs font-medium tracking-wide text-mg-or';
const HINT_CLASSES = 'mt-1 text-xs font-light italic text-mg-noir/50';

/**
 * Wrapper formulaire accessible (Server Component).
 *
 * Charte Maison Givre : label en capitales espacees gris, hint light
 * italique, erreur en or (l'or sert d'accent d'alerte premium dans la
 * palette ivoire/noir/or).
 *
 * a11y :
 *   - `<label htmlFor={name}>` -> liaison forte avec l'input id=name.
 *   - L'erreur a `role="alert"` + `aria-live` polite pour annoncer au
 *     screen reader le changement de validation.
 *   - L'`id="{name}-error"` permet a l'input de pointer dessus via
 *     `aria-describedby` (consumer's responsibility).
 *
 * Reutilisable par les forms metier (BoutiqueForm, EquipementForm,
 * UserInviteForm) sans dupliquer le markup.
 */
export function FormField({
  label,
  name,
  error,
  hint,
  required = false,
  children,
}: FormFieldProps) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const hasError = !!error;
  return (
    <div data-testid={`form-field-${name}`}>
      <label htmlFor={name} className={LABEL_CLASSES}>
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-mg-or">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !hasError ? (
        <p id={hintId} className={HINT_CLASSES}>
          {hint}
        </p>
      ) : null}
      {hasError ? (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className={ERROR_CLASSES}
          data-testid={`form-field-${name}-error`}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
