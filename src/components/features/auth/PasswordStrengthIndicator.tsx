'use client';

import { PASSWORD_MIN_LENGTH } from '@/lib/constants/auth';

interface PasswordStrengthIndicatorProps {
  readonly password: string;
  /** Id du conteneur, pour le rattacher via aria-describedby. */
  readonly id?: string;
}

interface Rule {
  readonly label: string;
  readonly satisfied: boolean;
}

function evaluateRules(password: string): readonly Rule[] {
  return [
    {
      label: `Au moins ${PASSWORD_MIN_LENGTH} caracteres`,
      satisfied: password.length >= PASSWORD_MIN_LENGTH,
    },
    { label: 'Une lettre minuscule', satisfied: /[a-z]/.test(password) },
    { label: 'Une lettre majuscule', satisfied: /[A-Z]/.test(password) },
    { label: 'Un chiffre', satisfied: /\d/.test(password) },
    {
      label: 'Un caractere special',
      satisfied: /[^A-Za-z0-9]/.test(password),
    },
  ];
}

/**
 * Liste sobre des criteres de force du mot de passe (style Maison Givre).
 *
 * Pas de barre de progression : la charte privilegie la typographie aux
 * elements "techno". Chaque critere est un item avec un marqueur or si
 * valide, point ivoire/40% sinon. Tout en capitales legeres et espacees.
 *
 * a11y : conteneur `aria-live="polite"` pour annoncer les changements de
 * statut sans interrompre la saisie utilisateur.
 */
export function PasswordStrengthIndicator({
  password,
  id,
}: PasswordStrengthIndicatorProps) {
  const rules = evaluateRules(password);

  return (
    <div
      id={id}
      aria-live="polite"
      aria-atomic="false"
      className="border border-mg-noir/10 bg-mg-ivoire/40 p-4"
      data-testid="password-strength"
    >
      <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.25em] text-mg-noir/60">
        Exigences du mot de passe
      </p>
      <ul className="space-y-2">
        {rules.map((rule) => (
          <li
            key={rule.label}
            className={
              rule.satisfied
                ? 'flex items-center gap-3 text-[11px] font-light uppercase tracking-[0.1em] text-mg-noir'
                : 'flex items-center gap-3 text-[11px] font-light uppercase tracking-[0.1em] text-mg-noir/40'
            }
            data-testid={`password-rule-${rule.satisfied ? 'ok' : 'ko'}`}
          >
            <span
              aria-hidden="true"
              className={
                rule.satisfied
                  ? 'inline-block h-1.5 w-1.5 rounded-full bg-mg-or'
                  : 'inline-block h-1.5 w-1.5 rounded-full border border-mg-noir/30 bg-transparent'
              }
            />
            <span className="sr-only">
              {rule.satisfied ? 'Critere rempli :' : 'Critere manquant :'}{' '}
            </span>
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
