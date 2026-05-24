# Architecture - Maison Givre HACCP

**Version** : 1.0
**Stack** : Next.js 15 (App Router) + React 19 + TypeScript 5 + Tailwind 4 + PostgreSQL 16 + Prisma 6 + NextAuth.js + Resend (email) + Vercel

---

## 1. Vue d'ensemble (C4 Context)

```
            ┌────────────────────┐
   Salarie ─┤  Smartphone perso  ├─┐
            └────────────────────┘ │
            ┌────────────────────┐ │      ┌──────────────────┐
Responsable─┤  Smartphone + PC   ├─┼──────│   HACCP Webapp   │
            └────────────────────┘ │      │  (Next.js Vercel)│
            ┌────────────────────┐ │      └────────┬─────────┘
     Admin ─┤        PC          ├─┘               │
            └────────────────────┘                 │
                                                    │
                            ┌───────────────────────┼─────────────┐
                            │                       │             │
                       ┌────▼─────┐        ┌────────▼──────┐ ┌────▼────┐
                       │  Neon    │        │   Vercel Blob │ │ Resend  │
                       │ Postgres │        │   (photos     │ │ (emails)│
                       │          │        │    v1.1)      │ │         │
                       └──────────┘        └───────────────┘ └─────────┘
```

## 2. Architecture applicative (C4 Container)

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Routes publiques : login, forgot-password
│   │   ├── login/
│   │   └── forgot-password/
│   ├── (app)/                    # Routes protegees
│   │   ├── releves/              # Salarie : tournee + saisie
│   │   ├── alertes/              # Responsable : gestion alertes
│   │   ├── historique/           # Responsable : lecture historique
│   │   ├── exports/              # Responsable/Admin : export CSV/PDF
│   │   ├── dashboard/            # Responsable/Admin
│   │   └── admin/                # Admin uniquement
│   │       ├── boutiques/
│   │       ├── equipements/
│   │       └── users/
│   ├── api/                      # API routes
│   │   ├── auth/                 # NextAuth handlers
│   │   ├── releves/              # POST, GET (filtres role)
│   │   ├── alertes/              # PATCH (resoudre)
│   │   ├── boutiques/            # CRUD admin
│   │   ├── equipements/          # CRUD admin
│   │   ├── users/                # CRUD admin
│   │   ├── exports/              # GET CSV / PDF
│   │   └── notifications/        # POST email (interne)
│   └── layout.tsx                # Root
├── components/
│   ├── ui/                       # Boutons, inputs, modals (partages)
│   └── features/                 # Composants metier (ReleveForm, AlerteCard, ...)
├── lib/
│   ├── prisma.ts                 # Singleton + middleware immutabilite
│   ├── auth.ts                   # NextAuth config
│   ├── services/                 # Logique metier (releveService, alerteService, ...)
│   ├── repositories/             # Acces donnees (optionnel pour v1, integre au service)
│   ├── validations/              # Schemas Zod
│   ├── email/                    # Templates + envoi Resend
│   ├── signature.ts              # Calcul signature numerique
│   └── permissions.ts            # Helpers role/boutique
├── middleware.ts                 # Auth + permissions routes
└── types/                        # Types globaux
```

### Layers (regle de dependance)

```
UI (Server Components + Client) -> API Routes (Zod + Auth + Permissions) -> Services -> Prisma -> PostgreSQL
```

- Server Components par defaut, `'use client'` UNIQUEMENT pour formulaires et interactivite
- Zod en validation a TOUTES les routes POST/PATCH
- Services contiennent la logique metier (regles RG du CCF)
- Prisma : 1 singleton, middleware bloque update/delete sur Releve

## 3. Modele de donnees (Prisma)

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

enum TypeEquipement {
  CONGELATEUR
  VITRINE
  CHAMBRE_FROIDE
  AUTRE
}

enum AlerteStatus {
  OUVERTE
  RESOLUE
  IGNOREE
}

// ===== MODELS =====

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String                          // bcrypt hash
  name      String
  role      UserRole
  actif     Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  boutiques        BoutiqueUser[]   // N-N via table de jonction (responsable multi-boutiques)
  boutiqueSalarie  Boutique?        @relation("SalarieBoutique", fields: [boutiqueSalarieId], references: [id])
  boutiqueSalarieId String?         // 1 boutique unique pour Salarie

  releves          Releve[]
  alertesResolues  Alerte[] @relation("ResoluPar")

  @@index([email])
  @@index([role])
}

model Boutique {
  id        String   @id @default(uuid())
  nom       String                          // ex: "MG Paris 11"
  adresse   String?
  ville     String?
  actif     Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  equipements  Equipement[]
  salaries     User[]         @relation("SalarieBoutique")
  responsables BoutiqueUser[]
  releves      Releve[]

  @@index([actif])
}

// Jonction N-N pour Responsable <-> Boutiques (Admin peut couvrir toutes via wildcard logique)
model BoutiqueUser {
  boutiqueId String
  userId     String
  createdAt  DateTime @default(now())

  boutique Boutique @relation(fields: [boutiqueId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([boutiqueId, userId])
  @@index([userId])
}

model Equipement {
  id          String         @id @default(uuid())
  nom         String                              // ex: "CGL-01"
  type        TypeEquipement
  seuilMin    Decimal        @db.Decimal(4, 1)    // ex: -25.0
  seuilMax    Decimal        @db.Decimal(4, 1)    // ex: -18.0
  actif       Boolean        @default(true)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  boutiqueId String
  boutique   Boutique @relation(fields: [boutiqueId], references: [id])

  releves Releve[]

  @@index([boutiqueId, actif])
}

model Releve {
  id               String   @id @default(uuid())
  date             DateTime @db.Date            // date metier du releve (jour)
  creneau          Creneau
  temperature      Decimal  @db.Decimal(4, 1)
  commentaire      String?
  alerteHorsSeuils Boolean  @default(false)
  signature        String                        // sha256 hex
  ip               String?
  annuleParId      String?  @unique              // pointer vers releve qui annule celui-ci
  motifAnnulation  String?                       // obligatoire si annule_par_id est set sur un releve
  createdAt        DateTime @default(now())      // timestamp serveur

  equipementId String
  equipement   Equipement @relation(fields: [equipementId], references: [id])

  boutiqueId String
  boutique   Boutique @relation(fields: [boutiqueId], references: [id])

  userId String
  user   User   @relation(fields: [userId], references: [id])

  // self-relation pour annulation
  annulePar Releve? @relation("ReleveAnnulation", fields: [annuleParId], references: [id])
  annule    Releve? @relation("ReleveAnnulation")

  alertes Alerte[]

  // Index critiques
  @@index([date, equipementId])
  @@index([boutiqueId, date])
  @@index([userId, createdAt])

  // Contrainte unicite : 1 releve ACTIF par (equipement, date, creneau)
  // En Prisma, on simule via partial unique avec NULL (Postgres native)
  @@unique([equipementId, date, creneau, annuleParId])
}

model Alerte {
  id                    String       @id @default(uuid())
  status                AlerteStatus @default(OUVERTE)
  commentaireResolution String?
  resoluAt              DateTime?
  createdAt             DateTime     @default(now())

  releveId String  @unique
  releve   Releve  @relation(fields: [releveId], references: [id])

  resoluParId String?
  resoluPar   User?   @relation("ResoluPar", fields: [resoluParId], references: [id])

  @@index([status, createdAt])
}
```

### Choix techniques importants

- **`date` separe de `createdAt`** : `date` = jour metier (eq. au creneau), `createdAt` = timestamp precis serveur. Permet retroactif (rare) et historisation.
- **`@@unique([equipementId, date, creneau, annuleParId])`** : avec `annuleParId NULL` = releve actif, on garantit l'unicite sur les actifs. Plusieurs annules cohabitent.
- **`signature` calculee en service** : pas dans la DB (concatenation + sha256 dans `lib/signature.ts`).
- **Salarie a `boutiqueSalarieId` direct** (1 boutique), Responsable passe par `BoutiqueUser` (N boutiques).

## 4. ADR (Architecture Decision Records)

### ADR-001 - Releves immuables (append-only)

- **Statut** : Accepte
- **Contexte** : Conformite HACCP exige une preuve immuable pour audit DDPP.
- **Decision** : Aucun UPDATE/DELETE sur `Releve`. Correction = nouveau releve "annulant" + motif.
- **Implementation** : middleware Prisma global bloque les operations dans `src/lib/prisma.ts`.
- **Consequences** : UI doit afficher historique annulations. Volume DB plus important (acceptable, releves restent petits).

### ADR-002 - Signature numerique automatique (v1.0)

- **Statut** : Accepte
- **Contexte** : Tracabilite legale exigee. Signature manuscrite par releve = friction inacceptable (objectif < 10s/saisie).
- **Decision** : Signature simple eIDAS : `sha256(userId || timestamp || ip || equipementId || creneau || temperature || commentaire)`. Stockee dans la table `Releve`.
- **Consequences** : Pas de canvas en v1.0. Si DDPP exige du manuscrit -> ajout en v1.1.

### ADR-003 - Single-schema (pas de multi-tenant)

- **Statut** : Accepte
- **Contexte** : Maison Givre est UNE seule organisation. Pas de cloisonnement organisationnel a faire.
- **Decision** : 1 base PostgreSQL, schema `public`. Cloisonnement par boutique (RG-PERM-001) gere au niveau service (filtre `boutiqueId IN session.user.boutiques`).
- **Consequences** : Migrations plus simples. Si Maison Givre devient une plateforme multi-marque plus tard, refactor multi-tenant en v3.

### ADR-004 - Vercel + Neon Postgres

- **Statut** : Accepte
- **Contexte** : Besoin de deploy rapide, pas d'equipe ops, budget initial nul.
- **Decision** : Vercel pour hebergement (CI/CD GitHub auto), Neon pour Postgres managee (gratuit jusqu'a 3 GB).
- **Consequences** : Limites serverless Vercel (timeout 10s/60s, pas de state en RAM) -> exports gros volumes streames, pas de cache in-memory.

### ADR-005 - NextAuth credentials + sessions JWT

- **Statut** : Accepte
- **Contexte** : Auth email/password, BYOD, session 30 min inactivite.
- **Decision** : NextAuth.js avec Credentials provider, strategie JWT (stateless, compatible Vercel serverless).
- **Consequences** : Logout cote serveur = invalider via cookie clear + token blacklist short-lived si besoin. Refresh token absent (volontaire, force re-login apres 30 min idle).

### ADR-006 - Resend pour emails

- **Statut** : Accepte
- **Contexte** : Notifications email sur alerte + recap quotidien.
- **Decision** : Resend (API simple, free tier 3000/mois, recommande Vercel).
- **Alternative** : SMTP custom (Sendgrid, Postmark, OVH SMTP). Decoupage via interface `EmailProvider` pour switch facile.

## 5. Permissions (cloisonnement)

| Action                     | SALARIE        | RESPONSABLE                 | ADMIN |
| -------------------------- | -------------- | --------------------------- | ----- |
| POST /api/releves          | Sa boutique    | Ses boutiques               | Tout  |
| GET /api/releves (today)   | Sa boutique    | Ses boutiques               | Tout  |
| GET /api/releves (history) | 7j sa boutique | Toute periode ses boutiques | Tout  |
| PATCH /api/alertes/:id     | ❌             | Ses boutiques               | Tout  |
| GET /api/exports/\*        | ❌             | Ses boutiques               | Tout  |
| /api/admin/\*\*            | ❌             | ❌                          | ✅    |

Cloisonnement enforced par helper `lib/permissions.ts` :

- `getAccessibleBoutiqueIds(session)` -> liste des IDs autorises
- Toutes les queries Prisma filtrent par `boutiqueId IN getAccessibleBoutiqueIds(session)`

## 6. Performance / Vercel

- **Timeout 10s** : OK pour saisie/lecture, exports gros volumes streames en chunks
- **Cold start** : tree-shaking strict, eviter gros imports (pdf-lib utilise dynamique)
- **DB pool** : Neon serverless driver avec pooling (pas de pool local)
- **Cache** : pas de cache in-memory. Cache HTTP via `next: { revalidate: 60 }` sur lectures non critiques.

## 7. Securite (resume)

- Middleware Prisma bloque mutations Releve (ADR-001)
- Timestamp/date generes serveur (RG, anti-falsification)
- Rate limiting auth via Upstash Redis (ou middleware Vercel)
- bcrypt rounds=12, HttpOnly+Secure cookies, CSRF NextAuth, headers securite via `next.config.ts`
- RGPD : journalisation IP releves (audit), purge comptes inactifs apres 30j desactivation
- Voir `docs/security.md` (a venir si besoin)
