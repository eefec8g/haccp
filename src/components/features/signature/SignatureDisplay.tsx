import type { SignatureRow } from '@/types/signature';
import { formatDateShort } from '@/lib/utils/dates';
import { MG_EYEBROW_CLASSES } from '@/lib/constants/styles';

/**
 * Affichage d'une signature manuscrite enregistree (US-SIG-001).
 *
 * Server Component pur. On utilise un `<img>` natif plutot que
 * `next/image` car les URLs Vercel Blob ne sont pas listees dans la
 * config `images.remotePatterns` du projet (cf. PhotoCard meme logique).
 *
 * Format de la meta-info :
 *   "Signe par {nomComplet} ({ROLE}) le {DD/MM/AAAA}"
 *
 * La date est formatee a partir de `signedAt` (Date) projete sur Paris :
 * on extrait la portion YYYY-MM-DD via `toISOString().slice(0, 10)` et on
 * la formate via `formatDateShort` (pas de dependance timezone runtime).
 *
 * a11y :
 *   - `<figure>` + `<figcaption>` semantique.
 *   - `alt` explicite sur l'image, `aria-label` sur la figure.
 */

const FIGURE_CLASSES =
  'flex flex-col gap-3 border border-mg-noir/10 bg-mg-ivoire p-5';
const HEADER_CLASSES = 'flex flex-col gap-1';
const TITLE_CLASSES =
  'text-base font-light uppercase tracking-[0.2em] text-mg-noir';
const IMAGE_WRAPPER_CLASSES =
  'flex justify-center border border-mg-noir/15 bg-white p-3';
const IMAGE_CLASSES = 'max-h-40 object-contain';
const META_CLASSES =
  'flex flex-col gap-1 text-[11px] font-light uppercase tracking-[0.2em] text-mg-noir/70';
const META_VALUE_CLASSES = 'font-medium normal-case text-mg-noir';

const HEADER_EYEBROW = 'Maison Givre - Registre signe';
const HEADER_TITLE = 'Signature du registre';
const ALT_PREFIX = 'Signature manuscrite de';

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface SignatureDisplayProps {
  readonly signature: SignatureRow;
  readonly testId?: string;
}

export function SignatureDisplay({ signature, testId }: SignatureDisplayProps) {
  const resolvedTestId = testId ?? 'signature-display';
  const dateISO = toISO(signature.signedAt);
  const dateShort = formatDateShort(dateISO);
  const altText = `${ALT_PREFIX} ${signature.signataireName} le ${dateShort}`;

  return (
    <figure
      aria-label={altText}
      className={FIGURE_CLASSES}
      data-testid={resolvedTestId}
    >
      <header className={HEADER_CLASSES}>
        <p className={MG_EYEBROW_CLASSES}>{HEADER_EYEBROW}</p>
        <h2 className={TITLE_CLASSES}>{HEADER_TITLE}</h2>
      </header>

      <div className={IMAGE_WRAPPER_CLASSES}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={signature.imageUrl}
          alt={altText}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={IMAGE_CLASSES}
          data-testid={`${resolvedTestId}-image`}
        />
      </div>

      <figcaption
        className={META_CLASSES}
        data-testid={`${resolvedTestId}-meta`}
      >
        <span>
          Signe par :{' '}
          <span className={META_VALUE_CLASSES}>{signature.signataireName}</span>
        </span>
        <span>
          Role :{' '}
          <span className={META_VALUE_CLASSES}>
            {signature.signataireRoleSnapshot}
          </span>
        </span>
        <span>
          Date :{' '}
          <time dateTime={dateISO} className={META_VALUE_CLASSES}>
            {dateShort}
          </time>
        </span>
      </figcaption>
    </figure>
  );
}
