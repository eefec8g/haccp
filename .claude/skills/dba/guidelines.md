---
name: dba
description: |
  Database Administrator - Base de données et performance.

  COMPÉTENCES:
  - Modélisation données (Prisma schema)
  - PostgreSQL et optimisation requêtes
  - Index et performance
  - Migrations et versioning
  - Multi-tenant (schema-per-tenant)
  - Backup et restore

  AUTOMATIC TRIGGERS:
  - User parle de "base de données", "SQL", "Prisma"
  - User mentionne "performance", "lenteur", "index"
  - User demande un schéma ou modèle
  - User parle de "migration", "backup"
  - User mentionne "requête lente", "N+1"

  MANUAL TRIGGERS:
  - /dba (mode persona)
  - /dba model "User avec relations"
  - /dba optimize "requête lente"
  - /dba migration "add column"

argument-hint: '[model <entité>] [optimize <requête>] [migration <description>] [index <table>]'
---

# Database Administrator - Guide Complet

Tu es un **DBA** expert en PostgreSQL et Prisma. Tu optimises les performances, modélises les données et gères les migrations.

---

## 1. MODÉLISATION PRISMA

### Schéma de Base

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ===== ENUMS =====
enum UserRole {
  SALARIE
  RESPONSABLE
  ADMIN
}

enum Creneau {
  MATIN
  MIDI
  SOIR
}

enum AlerteStatus {
  OUVERTE
  RESOLUE
  IGNOREE
}

// ===== MODELS =====
model User {
  id          String   @id @default(uuid())
  email       String   @unique
  password    String
  name        String
  role        UserRole
  emplacement String?  // boutique/atelier (pour les Salaries)
  actif       Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  releves Releve[]

  @@index([email])
  @@index([role])
}

model Congelateur {
  id          String   @id @default(uuid())
  nom         String   // ex: "CGL-01"
  emplacement String   // ex: "Atelier Nord"
  seuilMin    Decimal  @db.Decimal(4, 1) // ex: -25.0
  seuilMax    Decimal  @db.Decimal(4, 1) // ex: -18.0
  actif       Boolean  @default(true)
  createdAt   DateTime @default(now())

  releves Releve[]

  @@index([actif])
}

model Releve {
  id               String   @id @default(uuid())
  congelateurId    String
  date             DateTime @db.Date
  creneau          Creneau
  temperature      Decimal  @db.Decimal(4, 1)
  commentaire      String?
  alerteHorsSeuils Boolean  @default(false)
  annuleParId      String?  @unique // pointer vers le releve qui annule celui-ci
  createdAt        DateTime @default(now())

  congelateur Congelateur @relation(fields: [congelateurId], references: [id])

  userId String
  user   User   @relation(fields: [userId], references: [id])

  // self-relation pour annulation
  annulePar  Releve?  @relation("ReleveAnnulation", fields: [annuleParId], references: [id])
  annule     Releve?  @relation("ReleveAnnulation")

  alertes Alerte[]

  // 1 releve actif par (congelateur, date, creneau)
  @@unique([congelateurId, date, creneau, annuleParId])
  @@index([date, congelateurId])
  @@index([userId, createdAt])
}

model Alerte {
  id                    String       @id @default(uuid())
  releveId              String
  status                AlerteStatus @default(OUVERTE)
  commentaireResolution String?
  resoluParUserId       String?
  resoluAt              DateTime?
  createdAt             DateTime     @default(now())

  releve Releve @relation(fields: [releveId], references: [id])

  @@index([status])
  @@index([createdAt])
}
```

### Relations Avancées

```prisma
// Self-relation (releve annulant un releve precedent)
model Releve {
  annuleParId String? @unique
  annulePar   Releve? @relation("ReleveAnnulation", fields: [annuleParId], references: [id])
  annule      Releve? @relation("ReleveAnnulation")
}

// Many-to-many implicite (ex: users autorises sur des congelateurs specifiques)
model User {
  congelateursAutorises Congelateur[]
}

model Congelateur {
  usersAutorises User[]
}
```

---

## 2. NORMALISATION

### Formes Normales

#### 1NF - Valeurs Atomiques

```prisma
// ❌ Mauvais - Valeur non atomique
model User {
  skills String // "react,typescript,node"
}

// ✅ Bon - Table de relation
model User {
  skills UserSkill[]
}

model Skill {
  id   String @id
  name String @unique
  users UserSkill[]
}

model UserSkill {
  userId  String
  skillId String
  level   Int // 1-5

  user  User  @relation(fields: [userId], references: [id])
  skill Skill @relation(fields: [skillId], references: [id])

  @@id([userId, skillId])
}
```

#### 2NF - Dépendance Totale

```prisma
// ❌ Mauvais - userName dépend seulement de userId
model Releve {
  userId   String
  userName String // Redondant!
}

// ✅ Bon - Relation
model Releve {
  userId String
  user   User @relation(fields: [userId], references: [id])
}
```

#### 3NF - Pas de Dépendance Transitive

```prisma
// ❌ Mauvais - city dépend de postalCode qui dépend de id
model Address {
  id         String
  postalCode String
  city       String // Dépend de postalCode
}

// ✅ Bon - Table séparée
model Address {
  id           String
  postalCodeId String
  postalCode   PostalCode @relation(fields: [postalCodeId], references: [id])
}

model PostalCode {
  id   String @id
  code String @unique
  city String
}
```

### Quand Dénormaliser ?

- **Performance critique** : Éviter les JOINs coûteux
- **Lecture > Écriture** : Données rarement modifiées
- **Agrégations fréquentes** : Pré-calculer les totaux

```prisma
// Dénormalisation acceptable pour performance
model Congelateur {
  // Données calculées (mises à jour via trigger ou code)
  totalReleves    Int       @default(0)
  totalAlertes    Int       @default(0)
  lastReleveDate  DateTime?
}
```

---

## 3. INDEX ET PERFORMANCE

### Types d'Index PostgreSQL

| Type   | Usage                    | Exemple                        |
| ------ | ------------------------ | ------------------------------ |
| B-tree | Égalité, comparaisons    | `WHERE status = 'ACTIVE'`      |
| Hash   | Égalité uniquement       | `WHERE id = 'xxx'`             |
| GIN    | Arrays, JSONB, full-text | `WHERE tags @> ARRAY['react']` |
| GiST   | Géométrie, ranges        | `WHERE daterange && ...`       |

### Index dans Prisma

```prisma
model Releve {
  id            String   @id
  congelateurId String
  userId        String
  date          DateTime
  creneau       Creneau
  temperature   Decimal

  // Index simple
  @@index([creneau])

  // Index composé (ordre important!)
  @@index([date, congelateurId])
  @@index([userId, createdAt])

  // Index unique (1 releve actif par creneau)
  @@unique([congelateurId, date, creneau, annuleParId])
}

model User {
  email String

  // Index unique implicite avec @unique
  @@unique([email])
}
```

### Stratégie d'Indexation

```sql
-- 1. Identifier les requêtes lentes
EXPLAIN ANALYZE
SELECT * FROM releves
WHERE congelateur_id = 'xxx' AND date >= CURRENT_DATE - INTERVAL '7 days';

-- 2. Vérifier si index utilisé
-- Si "Seq Scan" → pas d'index utilisé
-- Si "Index Scan" → index utilisé ✅

-- 3. Créer l'index approprié
CREATE INDEX idx_releves_congelateur_date
ON releves (congelateur_id, date DESC);
```

### Règles d'Or

1. **Index les colonnes de WHERE fréquents**
2. **Index les clés étrangères** (Prisma le fait automatiquement)
3. **Index composés** : colonne la plus sélective en premier
4. **Pas trop d'index** : ralentit les écritures

---

## 4. OPTIMISATION REQUÊTES

### Problème N+1

```typescript
// ❌ N+1 - 1 requête + N requêtes
const releves = await db.releve.findMany();
for (const releve of releves) {
  const user = await db.user.findUnique({
    where: { id: releve.userId },
  });
}

// ✅ Bon - 1 seule requête avec include
const releves = await db.releve.findMany({
  include: {
    user: true,
  },
});

// ✅ Ou avec select pour optimiser
const releves = await db.releve.findMany({
  include: {
    user: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
  },
});
```

### Pagination Efficace

```typescript
// ❌ Offset pagination (lent pour grandes tables)
const page10 = await db.mission.findMany({
  skip: 9 * 100, // Doit scanner 900 lignes
  take: 100,
});

// ✅ Cursor pagination (constant time)
const page10 = await db.mission.findMany({
  take: 100,
  cursor: { id: lastSeenId },
  skip: 1, // Skip the cursor itself
});
```

### Sélection Minimale

```typescript
// ❌ Select tout
const users = await db.user.findMany();

// ✅ Select uniquement ce qui est nécessaire
const users = await db.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
    // password: false (pas inclus)
  },
});
```

### Agrégations

```typescript
// Compter
const count = await db.mission.count({
  where: { status: 'EN_COURS' },
});

// Grouper
const byStatus = await db.mission.groupBy({
  by: ['status'],
  _count: true,
});

// Agréger
const stats = await db.releve.aggregate({
  _avg: { temperature: true },
  _min: { temperature: true },
  _max: { temperature: true },
  _count: true,
  where: { congelateurId, date: { gte: startOfMonth() } },
});
```

### Raw Queries (si nécessaire)

```typescript
// Pour requêtes complexes non supportées par Prisma
const result = await db.$queryRaw`
  SELECT
    DATE_TRUNC('day', date) as jour,
    COUNT(*) as count,
    AVG(temperature) as temperature_moyenne
  FROM releves
  WHERE congelateur_id = ${congelateurId}
  GROUP BY DATE_TRUNC('day', date)
  ORDER BY jour DESC
  LIMIT 30
`;
```

---

## 5. MODELE HACCP (SINGLE-SCHEMA)

### Architecture

```
PostgreSQL Database (schema public)
├── users           (Salaries, Responsables, Admins)
├── congelateurs    (equipements physiques + seuils)
├── releves         (mesures - append-only)
└── alertes         (releves hors seuils a traiter)
```

L'app HACCP utilise un schema unique : pas de multi-tenant. Tous les utilisateurs appartiennent a une seule organisation (Maison Givre).

### Prisma singleton + middleware d'immutabilite

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

// Middleware HACCP : bloquer update/delete sur Releve (immuabilite)
db.$use(async (params, next) => {
  if (
    params.model === 'Releve' &&
    ['update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)
  ) {
    throw new Error(
      `Operation ${params.action} interdite sur Releve (immuabilite HACCP). Utilisez un releve d'annulation.`
    );
  }
  return next(params);
});
```

---

## 6. MIGRATIONS

### Workflow Migrations

```bash
# 1. Développement - Push rapide sans migration
npm run db:push

# 2. Avant commit - Créer la migration
npm run db:migrate -- --name add_user_avatar

# 3. Production - Déployer les migrations
npm run db:migrate:deploy
```

### Migration Personnalisée

```sql
-- prisma/migrations/20260128_add_user_avatar/migration.sql

-- Ajouter colonne
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;

-- Migration de données
UPDATE "User" SET "avatarUrl" = '/default-avatar.png' WHERE "avatarUrl" IS NULL;

-- Index si nécessaire
CREATE INDEX "User_avatarUrl_idx" ON "User"("avatarUrl");
```

### Seed Data

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  // Créer admin
  const admin = await db.user.upsert({
    where: { email: 'admin@maison-givre.fr' },
    update: {},
    create: {
      email: 'admin@maison-givre.fr',
      password: await hash('admin123', 12),
      name: 'Admin',
      role: 'ADMIN',
    },
  });

  // Créer un salarie de test
  const salarie = await db.user.create({
    data: {
      email: 'lea@maison-givre.fr',
      password: await hash('password123', 12),
      name: 'Lea Martin',
      role: 'SALARIE',
      emplacement: 'Atelier Nord',
    },
  });

  // Créer un congelateur
  const cgl = await db.congelateur.create({
    data: {
      nom: 'CGL-01',
      emplacement: 'Atelier Nord',
      seuilMin: -25,
      seuilMax: -18,
    },
  });

  console.log({ admin, salarie, cgl });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
```

---

## 7. BACKUP & RESTORE

### Backup PostgreSQL

```bash
# Backup complet
pg_dump -h localhost -U postgres -d haccp -F c -f backup_$(date +%Y%m%d).dump

# Backup schéma spécifique
pg_dump -h localhost -U postgres -d haccp -t releves -F c -f releves_backup.dump

# Backup données uniquement
pg_dump -h localhost -U postgres -d haccp --data-only -f data_backup.sql
```

### Restore

```bash
# Restore complet
pg_restore -h localhost -U postgres -d haccp -c backup_20260128.dump

# Restore vers nouvelle DB
createdb haccp_restored
pg_restore -h localhost -U postgres -d haccp_restored backup_20260128.dump
```

### Script Backup Automatique

```bash
#!/bin/bash
# scripts/backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="haccp"

# Créer backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -F c -f $BACKUP_DIR/backup_$DATE.dump

# Garder seulement les 7 derniers jours
find $BACKUP_DIR -name "backup_*.dump" -mtime +7 -delete

# Upload vers S3 (optionnel)
aws s3 cp $BACKUP_DIR/backup_$DATE.dump s3://my-bucket/backups/
```

---

## 8. MONITORING DB

### Requêtes Lentes

```sql
-- Activer le log des requêtes lentes
ALTER SYSTEM SET log_min_duration_statement = 1000; -- 1 seconde
SELECT pg_reload_conf();

-- Voir les requêtes en cours
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;

-- Tuer une requête bloquée
SELECT pg_cancel_backend(pid);
-- ou force kill
SELECT pg_terminate_backend(pid);
```

### Statistiques Tables

```sql
-- Taille des tables
SELECT
  schemaname,
  relname as table,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size,
  pg_size_pretty(pg_relation_size(relid)) as data_size,
  pg_size_pretty(pg_indexes_size(relid)) as index_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;

-- Index non utilisés
SELECT
  schemaname,
  relname as table,
  indexrelname as index,
  idx_scan as scans
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexrelname NOT LIKE 'pg_%';

-- Cache hit ratio (devrait être > 99%)
SELECT
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as cache_hit_ratio
FROM pg_statio_user_tables;
```

### Connexions

```sql
-- Nombre de connexions
SELECT count(*) FROM pg_stat_activity;

-- Connexions par état
SELECT state, count(*)
FROM pg_stat_activity
GROUP BY state;
```

---

## 9. CHECKLIST DBA

### Conception

- [ ] Schéma normalisé (3NF minimum)
- [ ] Types de données appropriés
- [ ] Clés primaires définies
- [ ] Clés étrangères avec ON DELETE approprié
- [ ] Index sur les FK et colonnes de recherche

### Performance

- [ ] EXPLAIN ANALYZE sur requêtes critiques
- [ ] Pas de N+1 queries
- [ ] Pagination avec cursor si possible
- [ ] Select uniquement les colonnes nécessaires

### Sécurité

- [ ] Pas de SQL injection (utiliser Prisma)
- [ ] Row-level security si multi-tenant
- [ ] Backups automatiques configurés
- [ ] Accès DB restreints (pas de wildcard %)

### Monitoring

- [ ] Alertes sur requêtes lentes
- [ ] Monitoring espace disque
- [ ] Monitoring connexions
