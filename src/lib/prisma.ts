import { PrismaClient } from '@prisma/client';

/**
 * Message d'erreur leve par le middleware d'immutabilite Releve
 * (RG-IMMU-001). Exporte pour permettre aux tests d'assert la
 * propagation exacte sans dupliquer la string.
 */
export const IMMUTABILITY_ERROR =
  "Operation interdite : la table Releve est immuable (HACCP). Creez un releve d'annulation.";

/**
 * Liste blanche des champs autorises dans un UPDATE sur Releve.
 *
 * SEUL `annuleParId` peut etre modifie, et SEUL de `null` vers un uuid
 * (US-REL-004 : le responsable cree un releve "annulation" et lie
 * l'original en posant ce pointeur). Toute autre mutation est rejetee.
 *
 * Ce trou controle preserve l'immutabilite HACCP (RG-IMMU-001) car :
 *   - on ne change PAS les champs metier (temperature, commentaire, ...) ;
 *   - le pointeur va de null -> uuid (one-way, jamais reset a null) ;
 *   - le couple original + annulation est cree dans une transaction
 *     dediee dans le service (cf. annulerReleve).
 */
const ALLOWED_RELEVE_UPDATE_FIELDS: ReadonlySet<string> = new Set([
  'annuleParId',
]);

/**
 * Exporte pour test unitaire (`prisma.test.ts`). Determine si un payload
 * `data` represente l'unique mutation autorisee (set annuleParId -> uuid).
 * Toute autre forme (champ different, valeur null/empty, mix) retourne
 * `false` et doit etre rejetee.
 */
export function isAnnulationOnlyUpdate(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length === 0) {
    return false;
  }
  return entries.every(([key, value]) => {
    if (!ALLOWED_RELEVE_UPDATE_FIELDS.has(key)) {
      return false;
    }
    // Set d'un id : la valeur doit etre une string non vide ; on
    // n'autorise PAS le reset a null/undefined (one-way).
    return typeof value === 'string' && value.length > 0;
  });
}

function createPrismaClient() {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

  // Immutabilite HACCP : aucun UPDATE/DELETE/UPSERT direct sur Releve.
  // Exception controlee : UPDATE { annuleParId: <uuid> } pour US-REL-004
  // (cf. ALLOWED_RELEVE_UPDATE_FIELDS et isAnnulationOnlyUpdate).
  return client.$extends({
    query: {
      releve: {
        update({ args, query }) {
          if (isAnnulationOnlyUpdate(args.data)) {
            return query(args);
          }
          throw new Error(IMMUTABILITY_ERROR);
        },
        updateMany() {
          throw new Error(IMMUTABILITY_ERROR);
        },
        delete() {
          throw new Error(IMMUTABILITY_ERROR);
        },
        deleteMany() {
          throw new Error(IMMUTABILITY_ERROR);
        },
        upsert() {
          throw new Error(IMMUTABILITY_ERROR);
        },
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
