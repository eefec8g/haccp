# CLAUDE.md

## REGLES ABSOLUES

### Regle #1 - Checks Avant Commit

```bash
npm run format:check && npm run type-check && npm run lint && npm run build && npm test -- --run
```

JAMAIS commiter si un check echoue. Exception : `.md` ou `.gitignore` uniquement.

### Regle #2 - Code Review

Checklist obligatoire pour toute review/score Clean Code :

| #   | Critere       | Regle                                                        |
| --- | ------------- | ------------------------------------------------------------ |
| 1   | Securite      | Auth, injection, timing attacks, user enum, tokens hors logs |
| 2   | Nommage       | Variables significatives, pas de magic numbers/strings       |
| 3   | Fonctions     | SRP, <20 lignes, max 2 args                                  |
| 4   | DRY           | Comparer fichiers similaires cross-files                     |
| 5   | SOLID         | SRP, DIP, OCP                                                |
| 6   | Types         | Pas de `any`/`as` sans type guard, enums Prisma              |
| 7   | Errors        | Jamais ignorer (catch vide), Result pattern                  |
| 8   | Immutabilite  | `const`, spread, readonly                                    |
| 9   | Tests         | `data-testid` sur elements interactifs                       |
| 10  | Accessibilite | `role`, `aria-*`, `aria-live`, `aria-describedby`            |

JAMAIS dire "10/10" sans preuve detaillee. TOUJOURS lister issues par severite.

---

## Domaine Metier

**HACCP App** = Webapp interne **Maison Givre** pour les releves de temperature des congelateurs conformes aux normes HACCP.

Objectif : permettre aux salaries de saisir tres rapidement (matin/midi/soir) la temperature de chaque congelateur, et conserver un historique tracable pour audit.

| Role            | Description                                            | Droits                                            |
| --------------- | ------------------------------------------------------ | ------------------------------------------------- |
| **Salarie**     | Personnel atelier/boutique qui releve les temperatures | Saisie releves (matin/midi/soir), lecture du jour |
| **Responsable** | Encadrant qui suit la conformite et valide les alertes | Lecture historique, export, gestion congelateurs  |
| **Admin**       | Gestionnaire des comptes et des equipements            | CRUD utilisateurs, CRUD congelateurs, parametres  |

Concepts cles :

- **Congelateur** : equipement physique identifie (nom + emplacement), avec seuils min/max de temperature.
- **Releve** : (congelateur, creneau, temperature, salarie, timestamp). Creneaux : `MATIN` | `MIDI` | `SOIR`.
- **Alerte** : declenchee si `temperature` hors seuils du congelateur. A justifier/commenter par le salarie.
- **Norme HACCP** : congelateur <= -18 degC en regime normal. Tout depassement doit etre trace.

Regles critiques :

1. **Tracabilite immuable** : un releve ne peut PAS etre supprime ni modifie apres validation. Seul un releve "annule" peut etre ajoute pour correction, avec motif.
2. **3 creneaux par jour par congelateur** : matin, midi, soir. L'UI doit afficher clairement ceux qui manquent.
3. **Saisie ultra-rapide** : 1 ecran = 1 congelateur = 1 chiffre. Optimise mobile/tablette en environnement froid (gros boutons, pas de clavier complexe).
4. **Alertes immediates** : hors seuils -> notification visuelle + obligation de commenter.
5. **Audit** : export CSV/PDF par periode pour les controles sanitaires.

---

## Stack & Architecture

**Stack** : Next.js 15 (App Router), React 19, TypeScript 5 strict, Tailwind CSS 4, PostgreSQL 16, Prisma 6, NextAuth.js, Vitest/Playwright, Zod

**Layers** : UI (Server Components) -> API (Routes + Zod + Auth) -> Service -> Repository -> DB

```
src/
|-- app/           # Routes (auth)/(salarie)/(responsable)/(admin)/api
|-- components/    # ui/ (partages) + features/ (metier)
|-- features/      # releves/, congelateurs/, alertes/, users/
|-- lib/           # prisma.ts, auth.ts, services/, repositories/, validations/
`-- types/         # Types globaux
```

---

## Conventions

- **Server Components par defaut**, `'use client'` seulement si hooks/events/browser APIs
- **Tailwind CSS 4** : `@import 'tailwindcss'`, postcss: `'@tailwindcss/postcss'`
- **Imports absolus** : `@/components/ui`, `@/lib/prisma`
- **Singleton Prisma** : `import { db } from '@/lib/prisma'`
- **Nommage** : composants `PascalCase.tsx`, utils `camelCase.ts`, constantes `UPPER_SNAKE_CASE`
- **Git** : `feat:` | `fix:` | `refactor:` | `docs:` | `test:` | `chore:` -- PR vers develop

---

## Commandes

```bash
npm run dev            # Dev server
npm run build          # Build prod
npm run type-check     # TS check
npm run lint:fix       # ESLint fix
npm run db:push        # Push schema
npm run db:migrate     # Migration
npm test               # Vitest
npm run test:e2e       # Playwright
```

---

## Ressources

- **[GIT_WORKFLOW.md](GIT_WORKFLOW.md)** -- Git Flow detaille
- **Fichiers cles** : `src/lib/prisma.ts`, `src/lib/auth.ts`, `src/middleware.ts`
- JAMAIS commiter `.env` ou `.env.local`
