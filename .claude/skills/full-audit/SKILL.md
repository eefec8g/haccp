---
name: full-audit
description: |
  Full Codebase Audit - Audit complet integrant TOUS les controles d'Anthony.
  Reproduit les 6 axes de la review PR #164 en un seul passage.

  AXES COUVERTS:
  1. Security (OWASP Top 10, multi-tenant, auth/authz, secrets, RGPD)
  2. Performance (N+1, indexes, cache, serverless, bundle)
  3. Test Coverage (execution, inventaire, qualite, business logic)
  4. 'use client' Audit (SSR vs CSR, boundary placement)
  5. Architecture Next.js (loading/error/not-found, layouts, route groups)
  6. Data Fetching Patterns (useEffect+fetch vs Server Components, Server Actions)

  AUTOMATIC TRIGGERS:
  - User demande un "audit complet", "full audit", "audit codebase"
  - User mentionne "review comme Anthony", "tous les controles"
  - User demande de "tout verifier"

  MANUAL TRIGGERS:
  - /full-audit
  - /full-audit --axes=security,perf,tests
  - /full-audit --branch=develop
  - /full-audit --quick (resume seulement, pas de deep scan)

argument-hint: '[--axes=<all|security|perf|tests|use-client|architecture|data-fetching>] [--branch=<branch>] [--quick]'
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, Task
---

# Full Codebase Audit - Les 6 Axes d'Anthony

Tu es un **Lead Reviewer** expert. Tu reproduis EXACTEMENT l'audit complet qu'Anthony (MADEiN83) a fait sur la PR #164, couvrant 6 axes d'analyse en un seul passage.

## WORKFLOW D'AUDIT

Executer les 6 axes dans l'ordre. Pour chaque axe, scanner les fichiers, analyser, et noter les findings.

Si `--axes` est specifie, ne lancer que les axes demandes.
Si `--quick` est specifie, faire un scan rapide sans lire chaque fichier en detail.

---

## AXE 1 : SECURITE (OWASP Top 10)

### 1.1 Multi-Tenant Isolation -- `src/lib/prisma.ts`

- withTenant(): SET LOCAL (transaction-scoped) ou SET (session-scoped)? SET = CRITIQUE (race condition)
- Validation du nom de schema (regex)?
- Singleton Prisma partage entre requetes?

### 1.2 Broken Access Control (A01) -- `src/lib/services/*.ts`, `src/app/api/**/route.ts`

- Auth check present sur chaque endpoint? (auth() ou session)
- Role check? IDOR check? (userId = resource owner?)
- Releves filtres par role (Salarie limite au jour courant)? Pas d'UPDATE/DELETE sur Releve?

### 1.3 Authentication & Session (A07) -- `src/middleware.ts`, `src/lib/auth.ts`

- Middleware enforce auth sur API routes? (pas juste NextResponse.next())
- Permissions par role (SALARIE/RESPONSABLE/ADMIN) sur API routes ET pages?
- PUBLIC_API_ROUTES correct? Rate limiting sur /api/auth?

### 1.4 Cryptographic Failures (A02) -- `src/lib/services/userService.ts`, `authService.ts`

- generateTemporaryPassword(): crypto.randomBytes() PAS Math.random()
- Bcrypt rounds >= 10, tokens de reset avec expiration

### 1.5 Secrets & Logging (A09) -- `src/app/api/auth/forgot-password/route.ts`, `src/lib/services/*.ts`

- Pas de token/password dans logs, pas de details internes dans reponses API
- .env.example complet, pas de secrets hardcodes

### 1.6 Security Headers -- `src/middleware.ts`, `next.config.ts`

- CSP, X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy

### 1.7 CSRF & Input Validation

- SameSite cookie, Zod sur toutes routes POST/PATCH/DELETE, pas de SQL brut

### 1.8 Rate Limiting -- `src/lib/services/rateLimitService*.ts`

- In-memory Map = inefficace en serverless
- X-Forwarded-For spoofable (utiliser x-vercel-forwarded-for), rate limit par email + IP

### Severity Scale Securite

| Severity | CVSS    | Critere                                             |
| -------- | ------- | --------------------------------------------------- |
| CRITICAL | 8.0+    | Data leakage, auth bypass, releve mutation possible |
| HIGH     | 6.0-7.9 | Missing auth, weak crypto, secret exposure          |
| MEDIUM   | 4.0-5.9 | Missing headers, CSRF, info leakage                 |
| LOW      | 0.1-3.9 | Hardcoded values, verbose logging                   |

---

## AXE 2 : PERFORMANCE

### 2.1 N+1 Query Patterns -- `src/lib/services/*.ts`

- forEach/map avec await (boucle sequentielle de requetes)
- findMany() sans take limit (releves peut grossir vite)
- Focus: exportService (export periode), alerteService (resolution batch)

### 2.2 Missing Database Indexes -- `prisma/schema.prisma`

- @@index composites: Releve(date,congelateurId), Releve(userId,createdAt), Alerte(status,createdAt)
- @@unique partielle pour 1 releve actif: (congelateurId, date, creneau, annuleParId)

### 2.3 Redundant Queries -- `src/lib/services/*.ts`

- Stats dashboard: 4 COUNT separees vs 1 groupBy, Promise.all quand possible

### 2.4 Export gros volumes -- `src/lib/services/exportService.ts`

- Streamer en CSV pour eviter de charger 12 mois de releves en RAM, cursor pagination

### 2.5 Serverless Compatibility

- In-memory Map (cache, rate-limit, queue) = perdu entre invocations Vercel
- Email transporter singleton, cron timeout Vercel 10s si N+1

### 2.6 Frontend Bundle -- `src/app/**/page.tsx`

- Pages 'use client' = JS inutile, barrel exports CC, debounce manquant sur filtres

### Severity Scale Performance

| Severity | Critere                                           |
| -------- | ------------------------------------------------- |
| CRITICAL | Cross-tenant data leak, OOM, serverless timeout   |
| MAJOR    | N+1, missing indexes, unnecessary client JS >50KB |
| MINOR    | Missing cache headers, redundant polling          |

---

## AXE 3 : TEST COVERAGE

### 3.1 Execution des tests

Run `npx prisma generate && npm test -- --run`. Note suites/tests passed/failed. Analyze root cause of failures.

### 3.2 Inventaire de couverture

Map source files to test files. Priority order:

- **P1**: Services (`src/lib/services/*.ts`), Validations (`src/lib/validations/*.ts`)
- **P2**: API Routes (`src/app/api/**/route.ts`), Middleware (`src/middleware.ts`)
- **P3**: Components (`src/components/features/**/*.tsx`), Hooks (`src/hooks/*.ts`)
- **P4**: Lib utils (`src/lib/*.ts`)

For untested files: list exported functions and risk level.

### 3.3 Qualite des tests

- Tests flaky (date-dependants sans vi.setSystemTime())
- Imports @prisma/client directs (need prisma generate)
- Error paths non testes (catch sans mockRejectedValue)
- Exports non couvertes (comparer exports vs describes)

### 3.4 Couverture logique metier

Verify tests exist for: releve immuable (middleware bloque update/delete), commentaire obligatoire si hors seuils, contrainte unique (1 releve actif par creneau), salarie limite au jour courant, timestamp serveur-side, permissions par role, export restreint Responsable/Admin.

### 3.5 Tests E2E

Check `tests/e2e/` and `.github/workflows/`. Critical paths: login Salarie, saisie releve OK, saisie hors seuils + commentaire, tentative de modification releve (echec attendu), export CSV par Responsable, admin CRUD users/congelateurs.

---

## AXE 4 : 'use client' AUDIT

### 4.1 Inventaire

Count: total .tsx/.ts files, files with 'use client', pages (page.tsx) with 'use client' (ANTI-PATTERN).

### 4.2 Classification

Classify each 'use client' file: **UNNECESSARY** (no hooks/events/browser API), **REFACTORABLE** (page CC -- extract client component, keep page SC), **CORRECT** (legitimately needs client).

### 4.3 Checks specifiques -- `src/app/**/page.tsx`

For each CC page: list hooks used, check if useSession() replaceable by auth() server-side, useRouter() by Link, metadata export possible (impossible in CC).

### 4.4 Correct pattern

Page = SC with `export const metadata`. Auth via `await auth()`. Delegate interactivity to child client components.

---

## AXE 5 : ARCHITECTURE NEXT.JS

### 5.1 Route Map

List all routes with SC/CC status.

### 5.2 Fichiers manquants

For each route group ((auth), (salarie), (responsable), (admin)): check loading.tsx, error.tsx, not-found.tsx (for dynamic [id] routes).

### 5.3 Layouts -- `src/app/**/layout.tsx`

- Empty layouts ({children} only) = useless
- Auth/role checks server-side in protected layouts
- Shared UI (nav, sidebar, header) in layout

### 5.4 Route Groups manquants

- (client)/ route group (defined in CLAUDE.md but absent?), duplicate routes

### 5.5 Organisation des composants

- Features colocated with routes vs components/features/?
- Barrel exports with 'use client' propagation, dead code (unused imports)

---

## AXE 6 : DATA FETCHING PATTERNS

### 6.1 Client-side fetch anti-pattern -- `src/app/**/page.tsx`, `src/components/features/**/*.tsx`, `src/hooks/*.ts`

- useEffect + fetch('/api/...') in pages/components
- useSession() instead of auth() server-side
- useState + isLoading instead of async Server Component

### 6.2 Missing Server Actions

- Count 'use server' files (0 = anti-pattern)
- Mutations via fetch instead of Server Actions -- list conversion candidates

### 6.3 Waterfall requests

- useSession() then fetch() (2 sequential round-trips)
- Parent fetch then child fetch (cascade), SubscriptionBanner fetch on every nav

### 6.4 Impact mesurable

For each anti-pattern: count extra round-trips, FCP/LCP impact, extra JS sent to browser.

---

## FORMAT DU RAPPORT

Start with an Executive Summary table, then detail each axe, end with prioritized recommendations.

### Executive Summary (required)

```markdown
| Axe           | Findings                         | Critique | Majeur | Moyen | Mineur |
| ------------- | -------------------------------- | -------- | ------ | ----- | ------ |
| Securite      | X                                | X        | X      | X     | X      |
| Performance   | X                                | X        | X      | X     | X      |
| Tests         | X suites, X tests, X% couverture | -        | -      | -     | -      |
| 'use client'  | X/Y pages CC (X%)                | -        | -      | -     | -      |
| Architecture  | X loading/error.tsx manquants    | -        | -      | -     | -      |
| Data Fetching | X anti-patterns                  | -        | -      | -     | -      |

**Evaluation globale**: [Pret pour prod / Corrections necessaires / Bloquant]
```

### Per-axe detail

For each axe: list findings with severity prefix (CRIT/MAJ/MIN), location (`file:line`), description, impact, and remediation. Include positive findings. Use tables for inventories (tests coverage gaps, 'use client' classification, missing files, data fetching anti-patterns).

### Closing sections

- **Recommendations prioritisees**: P0 (bloquant) > P1 (< 2 semaines) > P2 (< 1 mois) > P3 (nice to have)
- **Metrics Evolution**: Current vs Target table for key metrics (test count, SC%, security criticals, N+1 count)

---

## REGLES D'OR

1. **Toujours executer les tests** avant analyse
2. **Compter exports vs tests** pour chaque fichier source
3. **Lire chaque 'use client'** et verifier sa necessite
4. **Verifier indexes** pour chaque pattern de requete frequent
5. **Chercher N+1** dans boucles avec await
6. **Verifier auth** sur CHAQUE endpoint (presence ET correction)
7. **Compter round-trips** client-serveur par page
8. **Reporter les positifs** et les bonnes pratiques
9. **Jamais "tout va bien"** sans preuves -- comparer fichiers similaires entre eux
10. **Actions concretes** avec priorite et effort estime
