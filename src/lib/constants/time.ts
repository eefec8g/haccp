/**
 * Constantes temporelles partagees (cote serveur ET client).
 *
 * `MILLIS_PER_DAY` etait duplique entre `lib/utils/dates.ts` (serveur,
 * deps Prisma indirectes) et `ExportConsolideForm.tsx` (client). Cette
 * extraction satisfait DRY (Clean Code #4) sans introduire de dependance
 * Prisma cote client.
 *
 * Aucun import autre que types numeriques natifs : sur de pouvoir etre
 * tree-shake dans le bundle client.
 */

/**
 * Nombre de millisecondes dans un jour calendaire (24h).
 *
 * Attention : ne tient pas compte des changements d'heure DST. Pour les
 * comparaisons "meme jour Europe/Paris", passer par
 * `parseISODateUtc` + arithmetique UTC (cf. `lib/utils/dates.ts`).
 */
export const MILLIS_PER_DAY = 86_400_000;
