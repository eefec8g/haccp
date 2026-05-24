# HACCP - Maison Givre

Webapp interne de releves de temperature pour la chaine de glaciers **Maison Givre**.
Conformite HACCP, multi-boutiques, multi-equipements (congelateurs, vitrines, chambres froides).

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript 5 strict
- Tailwind CSS 4
- PostgreSQL 16 + Prisma 6
- NextAuth.js (Credentials provider, sessions JWT)
- Resend (emails)
- Vercel + Neon (production)

## Documentation projet

- `docs/cadrage.md` — Note de cadrage produit
- `docs/CCF.md` — Cahier des charges fonctionnel (regles metier)
- `docs/backlog.md` — User Stories priorisees par release
- `docs/architecture.md` — Architecture technique + ADR
- `CLAUDE.md` — Conventions et regles pour l'assistant Claude
- `GIT_WORKFLOW.md` — Workflow Git

## Demarrage

### Prerequis

- Node.js 20+
- Docker (pour Postgres local)
- npm

### Setup

```bash
# 1. Installer les dependances
npm install

# 2. Lancer Postgres local
docker compose up -d

# 3. Copier les variables d'environnement
cp .env.example .env
# Editer .env et generer AUTH_SECRET via : openssl rand -base64 32

# 4. Migrer la base + seed
npm run db:push
npm run db:seed

# 5. Lancer le dev server
npm run dev
```

L'app est disponible sur `http://localhost:3000`.

### Comptes seed

| Role        | Email                 | Mot de passe |
| ----------- | --------------------- | ------------ |
| Admin       | admin@maison-givre.fr | Password123! |
| Responsable | karim@maison-givre.fr | Password123! |
| Salarie     | lea@maison-givre.fr   | Password123! |

## Commandes

```bash
npm run dev              # Dev server
npm run build            # Build production
npm run type-check       # Verification TypeScript
npm run lint             # ESLint
npm run lint:fix         # ESLint + auto-fix
npm run format           # Prettier write
npm run test             # Vitest (unit)
npm run test:e2e         # Playwright (E2E)
npm run db:push          # Push schema vers DB (dev)
npm run db:migrate       # Creer migration
npm run db:seed          # Reseed
npm run db:studio        # Prisma Studio (GUI DB)
```

## Avant chaque commit

```bash
npm run format:check && npm run type-check && npm run lint && npm run build && npm test -- --run
```

JAMAIS commiter si un check echoue. Exception : `.md` ou `.gitignore`.
