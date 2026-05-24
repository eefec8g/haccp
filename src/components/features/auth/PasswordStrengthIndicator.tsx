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
    <ul
      id={id}
      aria-live="polite"
      aria-atomic="false"
      className="space-y-1 text-sm text-slate-600"
      data-testid="password-strength"
    >
      {rules.map((rule) => (
        <li
          key={rule.label}
          className={rule.satisfied ? 'text-green-700' : 'text-slate-500'}
          data-testid={`password-rule-${rule.satisfied ? 'ok' : 'ko'}`}
        >
          <span aria-hidden="true">{rule.satisfied ? 'OK ' : '... '}</span>
          <span className="sr-only">
            {rule.satisfied ? 'Critere rempli :' : 'Critere manquant :'}{' '}
          </span>
          {rule.label}
        </li>
      ))}
    </ul>
  );
}
