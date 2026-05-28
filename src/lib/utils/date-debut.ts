import {
  MILLIS_PER_DAY,
  isoFromDate,
  parseISODateUtc,
} from '@/lib/utils/dates';

/**
 * Helpers "date de debut d'activite" (Epic RELEVE).
 *
 * Probleme metier : les stats (conformite, releves manquants) ne doivent
 * PAS compter de creneaux manquants pour un equipement AVANT sa mise en
 * service ni avant l'ouverture de sa boutique.
 *
 * Date de debut effective d'un equipement :
 *   `MAX(boutique.dateOuverture, equipement.dateMiseEnService)`
 * soit la plus tardive des deux (un equipement ne peut pas etre releve
 * avant que sa boutique soit ouverte, ni avant sa propre mise en service).
 *
 * Comparaisons au niveau JOUR : les deux dates sont stockees `@db.Date`
 * (jour sans heure) et lues a minuit UTC par Prisma. On normalise tout
 * via `isoFromDate` (slice UTC) avant comparaison pour rester aligne sur
 * la convention de `dates.ts` (Releve.date stocke en UTC minuit). Pas de
 * dependance Prisma : helper pur, testable et utilisable cote client.
 */

interface DatesActivite {
  readonly dateOuverture: Date;
  readonly dateMiseEnService: Date;
}

/**
 * Retourne la date de debut effective : le MAX (jour) entre l'ouverture
 * de la boutique et la mise en service de l'equipement. Le resultat est
 * ancre a minuit UTC (cf. `parseISODateUtc`) pour des comparaisons jour
 * sans drift timezone.
 */
export function dateDebutEffective({
  dateOuverture,
  dateMiseEnService,
}: DatesActivite): Date {
  const ouvertureISO = isoFromDate(dateOuverture);
  const miseEnServiceISO = isoFromDate(dateMiseEnService);
  const latestISO =
    miseEnServiceISO > ouvertureISO ? miseEnServiceISO : ouvertureISO;
  return parseISODateUtc(latestISO);
}

/**
 * Indique si le jour `dateISO` (`YYYY-MM-DD`) est attendu, c.-a-d. si ses
 * 3 creneaux sont susceptibles d'etre saisis : vrai ssi le jour est >= a
 * la date de debut effective (comparaison au niveau jour).
 */
export function isJourAttendu(
  dateISO: string,
  dateDebutEffective: Date
): boolean {
  return dateISO >= isoFromDate(dateDebutEffective);
}

/**
 * Compte le nombre de jours de la periode `[dateStartISO, dateEndISO]`
 * (inclus) qui sont >= a la date de debut effective. Sert a borner
 * `totalRelevesAttendus` (multiplie ensuite par le nombre de creneaux).
 *
 * Iteration en UTC minuit (cf. `parseISODateUtc`) pour eviter les drifts
 * DST. Si la periode est inversee (`end < start`), retourne 0.
 */
export function countJoursAttendus(
  dateStartISO: string,
  dateEndISO: string,
  dateDebutEffective: Date
): number {
  const startMs = parseISODateUtc(dateStartISO).getTime();
  const endMs = parseISODateUtc(dateEndISO).getTime();
  const debutISO = isoFromDate(dateDebutEffective);
  let count = 0;
  for (let t = startMs; t <= endMs; t += MILLIS_PER_DAY) {
    if (isoFromDate(new Date(t)) >= debutISO) {
      count += 1;
    }
  }
  return count;
}
