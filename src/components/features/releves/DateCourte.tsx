import { formatDateShort, todayParisISO } from '@/lib/utils/dates';

/**
 * Affiche une date courte `JJ/MM/AAAA` (decision technique #4).
 *
 * - Si `dateISO` est une chaine ISO `YYYY-MM-DD`, on la formate brut.
 * - Si on passe un `Date`, on extrait sa partie `YYYY-MM-DD` Europe/Paris
 *   via `todayParisISO` (defense : evite l'affichage du jour J-1 quand
 *   le serveur est en UTC et la date d'entree pointe vers minuit UTC).
 *
 * Server Component (pure presentation, pas d'interactivite).
 */
interface DateCourteProps {
  readonly value: string | Date;
  readonly className?: string;
  readonly 'data-testid'?: string;
}

function toISO(value: string | Date): string {
  return typeof value === 'string' ? value : todayParisISO(value);
}

export function DateCourte({
  value,
  className,
  'data-testid': dataTestid,
}: DateCourteProps) {
  const iso = toISO(value);
  return (
    <time
      dateTime={iso}
      className={className}
      data-testid={dataTestid ?? 'date-courte'}
    >
      {formatDateShort(iso)}
    </time>
  );
}
