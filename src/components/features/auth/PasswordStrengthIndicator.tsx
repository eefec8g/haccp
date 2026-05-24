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
      className="rounded-[7px] border border-[#DFE5EF] bg-[#ECF2FF]/40 p-4"
      data-testid="password-strength"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#2A3547]/70">
        Exigences du mot de passe
      </p>
      <ul className="space-y-1.5 text-sm">
        {rules.map((rule) => (
          <li
            key={rule.label}
            className={
              rule.satisfied
                ? 'flex items-center gap-2 text-[#0a9d83]'
                : 'flex items-center gap-2 text-[#2A3547]/60'
            }
            data-testid={`password-rule-${rule.satisfied ? 'ok' : 'ko'}`}
          >
            <span
              aria-hidden="true"
              className={
                rule.satisfied
                  ? 'inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#13DEB9]/20 text-xs font-bold text-[#0a9d83]'
                  : 'inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#DFE5EF] text-xs text-gray-400'
              }
            >
              {rule.satisfied ? 'v' : ''}
            </span>
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
