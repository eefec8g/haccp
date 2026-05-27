import type { Creneau } from '@prisma/client';
import {
  CRENEAU_HEURES,
  CRENEAU_ORDER,
  TIMEZONE,
} from '@/lib/constants/releve';
import { MILLIS_PER_DAY as TIME_MILLIS_PER_DAY } from '@/lib/constants/time';

/**
 * Utilitaires de dates Europe/Paris pour l'Epic RELEVE.
 *
 * Toutes les operations utilisent `Intl.DateTimeFormat` avec
 * `timeZone: 'Europe/Paris'` pour rester correctes quel que soit le
 * fuseau horaire du serveur (Vercel us-east-1 par defaut).
 *
 * Pourquoi pas une lib (date-fns-tz, luxon) ? Tres peu d'operations
 * timezone-aware necessaires, Intl est natif et sans dependance.
 */

/**
 * Re-export de `MILLIS_PER_DAY` depuis `@/lib/constants/time` (CC-8 :
 * source de verite unique cote serveur + client). Conserve a `dates.ts`
 * pour preserver l'API publique consommee par d'autres modules.
 */
export const MILLIS_PER_DAY = TIME_MILLIS_PER_DAY;

interface ParisDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
}

/**
 * Extrait year/month/day/hour pour `date` projete dans Europe/Paris.
 * Lecture via `Intl.DateTimeFormat#formatToParts` plutot que `format`
 * pour eviter le parsing fragile d'une string.
 */
function getParisParts(date: Date): ParisDateParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      lookup[part.type] = part.value;
    }
  }

  // Intl.DateTimeFormat renvoie parfois "24" pour minuit selon le locale
  // (ICU). On normalise vers 0 pour rester aligne sur les bornes 0..23.
  const rawHour = Number.parseInt(lookup.hour ?? '0', 10);
  return {
    year: Number.parseInt(lookup.year ?? '1970', 10),
    month: Number.parseInt(lookup.month ?? '1', 10),
    day: Number.parseInt(lookup.day ?? '1', 10),
    hour: rawHour === 24 ? 0 : rawHour,
  };
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/**
 * Retourne la date du jour Europe/Paris au format `YYYY-MM-DD`.
 *
 * Utilise pour la colonne `Releve.date` (typee `@db.Date`) et les
 * comparaisons "today" sans heure.
 */
export function todayParisISO(now: Date = new Date()): string {
  const { year, month, day } = getParisParts(now);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Convertit une date ISO `YYYY-MM-DD` en `Date` UTC ancree a 00:00.
 *
 * Le champ `Releve.date` Prisma utilise `@db.Date` (sans timezone), donc
 * on stocke conventionnellement minuit UTC pour eviter les decalages
 * de fuseau a la relecture.
 */
export function parseISODateUtc(dateISO: string): Date {
  return new Date(`${dateISO}T00:00:00.000Z`);
}

/**
 * Determine le creneau courant Europe/Paris selon les bornes
 * (CRENEAU_HEURES). Hors 5h-23h, retourne null (creux nocturne).
 */
export function getCurrentCreneau(now: Date = new Date()): Creneau | null {
  const { hour } = getParisParts(now);
  for (const creneau of CRENEAU_ORDER) {
    const { start, end } = CRENEAU_HEURES[creneau];
    if (hour >= start && hour < end) {
      return creneau;
    }
  }
  return null;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formate une date ISO `YYYY-MM-DD` en `JJ/MM/AAAA` (decision #4).
 * On n'utilise pas Intl ici : la date d'entree est deja une chaine ISO
 * sans heure, le formattage est purement textuel et evite tout risque
 * de decalage timezone.
 *
 * Si l'entree ne respecte pas le format attendu, on renvoie la chaine
 * brute pour eviter qu'un bug d'affichage casse la page.
 */
export function formatDateShort(dateISO: string): string {
  const match = ISO_DATE_PATTERN.exec(dateISO);
  if (!match) {
    return dateISO;
  }
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/**
 * Retourne la plage `[from, to]` couvrant les `days` derniers jours
 * (inclus aujourd'hui) en Europe/Paris.
 *
 * Bornes utilisables directement comme `gte`/`lte` sur `Releve.date`
 * (stockee en UTC minuit, cf. parseISODateUtc).
 */
export function getRecentDaysRange(
  days: number,
  now: Date = new Date()
): { readonly from: Date; readonly to: Date } {
  if (days < 1) {
    const todayISO = todayParisISO(now);
    const today = parseISODateUtc(todayISO);
    return { from: today, to: today };
  }
  const todayISO = todayParisISO(now);
  const to = parseISODateUtc(todayISO);
  const from = new Date(to.getTime() - (days - 1) * MILLIS_PER_DAY);
  return { from, to };
}

/**
 * Formate une `Date` en chaine ISO `YYYY-MM-DD` (slice UTC).
 *
 * Utilise pour bucketiser des series temporelles sur le jour calendaire
 * UTC (cf. `Releve.date` stocke en UTC minuit).
 */
export function isoFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Retourne le dernier instant (`23:59:59.999`) du jour represente par
 * `date`, dans le meme referentiel UTC. Pratique comme borne `lte` sur
 * des champs `DateTime` quand on borne sur un jour calendaire.
 */
export function endOfDay(date: Date): Date {
  return new Date(date.getTime() + MILLIS_PER_DAY - 1);
}

/**
 * Verifie si une date ISO `YYYY-MM-DD` est dans la fenetre des
 * `days` derniers jours Europe/Paris (today inclus).
 */
export function isWithinRecentDays(
  dateISO: string,
  days: number,
  now: Date = new Date()
): boolean {
  const { from, to } = getRecentDaysRange(days, now);
  const target = parseISODateUtc(dateISO).getTime();
  return target >= from.getTime() && target <= to.getTime();
}

/**
 * Calcule la difference inclusive en jours calendaires entre deux dates.
 *
 * Accepte indifferemment une chaine ISO `YYYY-MM-DD` ou un `Date`. Pour
 * une chaine ISO, le calcul se fait en UTC pour eviter les drifts DST
 * (cf. `parseISODateUtc`). Pour un `Date`, la comparaison utilise les
 * timestamps bruts -- le caller doit s'assurer que les dates sont sur
 * un meme referentiel temporel coherent.
 *
 * Convention "inclusive" : meme jour -> 1, j -> j+1 -> 2, etc. Aligne
 * avec la semantique HACCP "periode du <date debut> au <date fin> inclus"
 * utilisee partout dans le domaine (listing, exports, registres).
 *
 * Edge cases :
 *   - Dates inversees (`end < start`) : retourne une valeur negative ou
 *     <= 0 -- les callers verifient l'ordre en amont (ex. `dateEnd >=
 *     dateStart` cote Zod / service).
 *   - Entrees invalides (NaN apres parsing) : retourne `0`. Permet de ne
 *     pas casser l'UI client en cas de saisie partielle, le caller doit
 *     valider l'entree separement avant d'afficher le resultat.
 *
 * Helper pur (pas de dep Prisma) -- utilisable cote client.
 */
export function daysInclusive(
  dateStart: string | Date,
  dateEnd: string | Date
): number {
  const startMs = toEpochMs(dateStart);
  const endMs = toEpochMs(dateEnd);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return 0;
  }
  return Math.floor((endMs - startMs) / MILLIS_PER_DAY) + 1;
}

function toEpochMs(value: string | Date): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  return parseISODateUtc(value).getTime();
}
