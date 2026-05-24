import { PrismaClient } from '@prisma/client';

function createPrismaClient() {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

  // Immutabilite HACCP : aucun UPDATE/DELETE/UPSERT direct sur Releve.
  // La correction se fait via un nouveau releve avec annuleParId pointant vers l'original.
  return client.$extends({
    query: {
      releve: {
        update() {
          throw new Error(
            "Operation interdite : la table Releve est immuable (HACCP). Creez un releve d'annulation."
          );
        },
        updateMany() {
          throw new Error(
            'Operation interdite : la table Releve est immuable (HACCP).'
          );
        },
        delete() {
          throw new Error(
            'Operation interdite : la table Releve est immuable (HACCP).'
          );
        },
        deleteMany() {
          throw new Error(
            'Operation interdite : la table Releve est immuable (HACCP).'
          );
        },
        upsert() {
          throw new Error(
            'Operation interdite : la table Releve est immuable (HACCP).'
          );
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
