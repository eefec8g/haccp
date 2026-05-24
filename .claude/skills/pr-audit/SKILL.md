---
name: pr-audit
description: |
  PR Audit - Reproduit l'audit complet d'Anthony (MADEiN83) sur une PR.
  Poste 3 commentaires de review separes: Securite, Performance, Test Coverage.

  COMPETENCES:
  - Audit securite OWASP Top 10 avec CVSS scoring sur le diff d'une PR
  - Audit performance (N+1, indexes, serverless, frontend) sur le diff
  - Audit test coverage (execution, inventaire, qualite, logique metier)
  - Publication des 3 rapports en commentaires PR sur GitHub

  AUTOMATIC TRIGGERS:
  - User demande un "audit PR", "pr audit", "audit comme Anthony"
  - User mentionne "review complete PR", "3 reviews PR"
  - User demande de "reviewer la PR comme Anthony"

  MANUAL TRIGGERS:
  - /pr-audit 164
  - /pr-audit --pr=164
  - /pr-audit --branch=develop
  - /pr-audit --pr=164 --post (poste les commentaires sur GitHub)
  - /pr-audit --pr=164 --axes=security,perf,tests

argument-hint: '<PR_number|--branch=branch> [--post] [--axes=<all|security|perf|tests>]'
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, Task
---

# PR Audit - Les 3 Reviews d'Anthony

Tu es un **Lead Reviewer** expert. Tu reproduis EXACTEMENT les 3 reviews qu'Anthony (MADEiN83) a faites sur la PR #164, adaptees au diff de la PR cible.

---

## WORKFLOW COMPLET

### Phase 0: Preparation

```bash
# Determiner le perimetre
# Option A: Depuis un numero de PR
PR_NUMBER=$1
gh pr view $PR_NUMBER --json baseRefName,headRefName,files --jq '{base: .baseRefName, head: .headRefName, files: [.files[].path]}'

# Option B: Depuis une branche (compare vs main)
BRANCH="${1:-develop}"
BASE="${2:-main}"
```

```bash
# Lister TOUS les fichiers modifies dans le diff
git diff $BASE..$HEAD --name-only

# Compter les changements
git diff $BASE..$HEAD --stat

# Voir le log des commits
git log $BASE..$HEAD --oneline
```

IMPORTANT: Lire chaque fichier modifie. Ne JAMAIS auditer sans avoir lu le code reel.

### Phase 1: Lancer les 3 reviews en PARALLELE

Utiliser le Task tool pour lancer 3 agents en parallele:

1. Agent Security (subagent_type: senior-dev)
2. Agent Performance (subagent_type: senior-dev)
3. Agent Test Coverage (subagent_type: senior-dev)

Chaque agent recoit la liste des fichiers modifies et sa checklist specifique.

### Phase 2: Consolider les rapports

Combiner les 3 rapports. Pour chaque finding:

- Verifier qu'il est base sur du code REEL lu (pas une supposition)
- Attribuer une severite coherente
- Proposer une remediation concrete

### Phase 3: Poster les commentaires (si `--post`)

```bash
# Poster chaque review comme un commentaire separe sur la PR
gh pr comment $PR_NUMBER --body "$(cat /tmp/pr-audit-security.md)"
gh pr comment $PR_NUMBER --body "$(cat /tmp/pr-audit-performance.md)"
gh pr comment $PR_NUMBER --body "$(cat /tmp/pr-audit-tests.md)"
```

Si `--post` n'est pas specifie, afficher les 3 rapports dans la console.

---

## REVIEW 1 : SECURITE

### Checklist des 9 domaines

#### 1.1 Controle d'acces et isolation des donnees

```
Fichiers a lire:
- src/lib/prisma.ts (middleware bloque update/delete sur Releve?)
- src/middleware.ts (permissions par role sur API routes?)
- src/lib/services/*Service.ts (filtrage par role/userId?)
- src/app/api/**/route.ts (IDOR checks?)

Controles:
- [ ] Middleware Prisma bloque update/delete/updateMany/deleteMany sur Releve
- [ ] Chaque endpoint API verifie que userId correspond a la session
- [ ] Releves filtres par role (Salarie: jour courant uniquement)
- [ ] Permissions par role (SALARIE/RESPONSABLE/ADMIN) sur API routes ET pages
- [ ] Timestamp et date generes serveur (jamais accepter du body)
```

#### 1.2 Authentification

```
Fichiers a lire:
- src/middleware.ts (PUBLIC_API_ROUTES allowlist?)
- src/lib/auth.ts (session config, maxAge?)
- src/lib/socket.ts (JWT auth sur WebSocket?)
- src/lib/cronAuth.ts (CRON_SECRET verification?)
- src/app/api/stripe/webhooks/route.ts (signature verification?)

Controles:
- [ ] Middleware enforce auth par defaut sur API routes (pas opt-in)
- [ ] PUBLIC_API_ROUTES est une allowlist explicite
- [ ] Socket.IO verifie JWT avant connexion
- [ ] Cron endpoints verifient CRON_SECRET
- [ ] Webhooks Stripe verifient la signature
```

#### 1.3 Cryptographie et secrets

```
Rechercher:
- grep -rn "Math.random" src/lib/services/ src/app/api/
- grep -rn "sk_live\|sk_test\|password\s*=\s*['\"]" src/

Controles:
- [ ] generateTemporaryPassword() utilise crypto.randomBytes() PAS Math.random()
- [ ] Bcrypt >= 10 rounds (12 recommande)
- [ ] Tokens generes avec crypto.randomBytes()
- [ ] Tokens avec expiration (email: 24h, reset: 1h, invitation: 72h)
- [ ] Tokens marques usedAt apres consommation
- [ ] Aucun secret hardcode dans le code
- [ ] .env dans .gitignore
```

#### 1.4 Fuites d'informations

```
Rechercher:
- grep -rn "logger.*token\|logger.*password\|logger.*secret" src/
- grep -rn "error\.message" src/app/api/
- grep -rn "previewUrl\|emailPreview" src/app/api/

Controles:
- [ ] Pas de tokens/passwords dans les logs
- [ ] Error responses utilisent internalErrorResponse() (pas error.message)
- [ ] Pas de stack traces exposes en production
- [ ] Pas de preview URLs dans les reponses API
- [ ] User enumeration: messages identiques pour login/register/forgot-password
```

#### 1.5 Validation des entrees

```
Controles:
- [ ] Chaque POST/PATCH utilise schema.safeParse(body) avec Zod
- [ ] $executeRawUnsafe valide les inputs avec regex
- [ ] Templates email echappent les valeurs utilisateur (escapeHtml())
- [ ] Cles S3/storage sanitisent les inputs
- [ ] Liens notifications valides (pas javascript:, data:)
- [ ] Noms de schemas tenant valides (/^[a-zA-Z_][a-zA-Z0-9_]*$/)
```

#### 1.6 Rate limiting

```
Fichiers a lire:
- src/lib/services/rateLimitService.ts
- src/app/api/auth/login/route.ts (getClientIdentifier)

Controles:
- [ ] Rate limit login: max 5 / 15 min
- [ ] IP extraction: x-vercel-forwarded-for prioritaire (pas x-forwarded-for brut)
- [ ] Rate limit par email aussi, pas juste IP
- [ ] Store in-memory a un warning pour serverless
- [ ] Plan de migration Redis documente
```

#### 1.7 CSRF, cookies et headers de securite

```
Fichiers a lire:
- next.config.ts (headers)
- src/lib/auth.ts (cookie config)

Controles:
- [ ] SameSite=Lax ou Strict sur cookies de session
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY
- [ ] Strict-Transport-Security
- [ ] Referrer-Policy: strict-origin-when-cross-origin
- [ ] target="_blank" avec rel="noopener noreferrer"
```

#### 1.8 Configuration et CI/CD

```
Controles:
- [ ] GitHub Actions utilisent secrets.* (pas de valeurs en dur)
- [ ] .env.example complet (CRON_SECRET, STRIPE_WEBHOOK_SECRET inclus)
- [ ] .gitignore couvre .env, .env.local, .env.production
- [ ] Scripts utilitaires sans PII hardcode
- [ ] Production guards sur scripts de maintenance
```

#### 1.9 Conformite RGPD

```
Controles:
- [ ] Data minimization: select Prisma explicites
- [ ] Right to erasure: mecanisme de suppression
- [ ] PII dans logs: seulement identifiants non-sensibles
- [ ] Consentement: formulaires avec acceptation explicite
```

### Format du rapport securite

Titre: `# Security Review - [branch/PR]`. Sections: Summary (avec severity counts Critical/High/Medium/Low), puis findings groupes par severite (Critical, High, Medium, Low). Chaque finding: ID (CRIT-XX/HIGH-XX/MED-XX/LOW-XX), CWE reference, Location (fichier:ligne), CVSS score, Description, Impact, Remediation. Terminer par: Positive Findings, Recommendations (Immediate/Short-Term/Long-Term), tableau OWASP Top 10 (2021) alignment, notes RGPD.

---

## REVIEW 2 : PERFORMANCE

### Checklist des 6 domaines

#### 2.1 Requetes base de donnees (N+1, unbounded)

```
Fichiers a lire:
- src/lib/services/*.ts (toutes les fonctions avec boucles + await)
- src/lib/prisma-optimized.ts

Rechercher:
- Boucles forEach/for..of avec des appels Prisma a l'interieur
- findMany sans take (fetch illimite)
- count() multiples sur la meme table (remplacer par groupBy)
- Requetes sequentielles qui pourraient etre paralleles (Promise.all)

Controles specifiques:
- [ ] exportService: export periode utilise streaming/cursor (pas tout charger en RAM)
- [ ] findReleves* a un take limit ou cursor pagination
- [ ] getDashboardStats utilise groupBy au lieu de N count()
- [ ] Requetes independantes en Promise.all
```

#### 2.2 Index base de donnees

```
Fichier a lire: prisma/schema.prisma

Croiser les @@index avec les patterns de requetes dans les services:
- [ ] Releve: @@index([date, congelateurId]) pour historique/exports
- [ ] Releve: @@index([userId, createdAt]) pour activite par user
- [ ] Releve: @@unique([congelateurId, date, creneau, annuleParId]) (1 releve actif)
- [ ] Alerte: @@index([status, createdAt]) pour dashboard responsable
- [ ] User: @@index([email]) pour login
```

#### 2.3 Client search performance

```
Fichier: src/lib/services/clientService.ts

Controles:
- [ ] searchClients utilise startsWith (pas contains/ILIKE avec leading wildcard)
- [ ] SIRET search utilise startsWith (indexable)
- [ ] Requetes numeriques (SIRET) ont un chemin specifique
```

#### 2.4 Frontend performance

```
Fichiers: src/app/**/page.tsx, src/components/features/**/*.tsx

Controles:
- [ ] Pages sans hooks/events sont des Server Components (pas 'use client')
- [ ] Dashboard utilise auth() server-side (pas useSession client)
- [ ] Filtres marketplace ont un debounce (300ms min)
- [ ] useEffect avec cleanup (clearInterval, removeEventListener)
- [ ] useRef pour objets reutilises (Audio, timers)
- [ ] Pas de polling redondant quand WebSocket callbacks existent
```

#### 2.5 Backend & API

```
Controles:
- [ ] Email transporter est un singleton (pas cree par requete)
- [ ] Prisma client est un singleton (globalForPrisma)
- [ ] Batch processing: createMany/updateMany (pas de boucle create)
- [ ] API responses ne retournent pas plus de donnees que necessaire
```

#### 2.6 Compatibilite serverless

```
Rechercher:
- new Map() / new Set() dans src/lib/ (etat in-memory)
- writeFile/appendFile (filesystem read-only en serverless)

Controles:
- [ ] In-memory cache/rate-limit/queue documentes comme dev-only ou avec warning
- [ ] Cron jobs respectent timeout Vercel (10s defaut, maxDuration si besoin)
- [ ] Socket.IO necessite serveur persistant (pas serverless natif)
```

### Format du rapport performance

Titre: `# Performance Review - [branch/PR]`. Sections: Summary (avec severity counts Critical/Major/Minor), puis findings groupes par domaine (Database and Queries, Frontend Performance, API and Backend, Infrastructure). Chaque finding: ID (CRIT-X/MAJ-X/MIN-X), Location, Issue, Impact, Suggestion. Terminer par: Positive Findings, Recommendations par priorite (P1 Must Fix / P2 Should Fix / P3 Nice to Have) en tableaux.

---

## REVIEW 3 : TEST COVERAGE

### Checklist des 5 etapes

#### 3.1 Execution des tests

```bash
# 1. S'assurer que Prisma est genere
npx prisma generate 2>&1

# 2. Lancer tous les tests
npm test -- --run 2>&1

# 3. Noter: X suites, Y tests passed, Z failed
# 4. Pour chaque echec: root cause (import, mock, assertion)
```

#### 3.2 Inventaire source vs tests

```
Pour CHAQUE categorie, scanner et comparer:

| Source Pattern | Test Pattern | Priorite |
|---------------|-------------|----------|
| src/lib/services/*.ts | tests/unit/lib/services/*.test.ts | P1 CRITIQUE |
| src/lib/validations/*.ts | tests/unit/lib/validations/*.test.ts | P1 HIGH |
| src/app/api/**/route.ts | tests/unit/app/api/**/*.test.ts | P2 HIGH |
| src/middleware.ts | tests/unit/middleware.test.ts | P2 HIGH |
| src/components/features/**/*.tsx | tests/unit/components/**/*.test.tsx | P3 MEDIUM |
| src/hooks/*.ts | tests/unit/hooks/*.test.ts | P3 MEDIUM |
| src/lib/*.ts | tests/unit/lib/*.test.ts | P4 LOW |

Pour chaque fichier SANS test:
- Lister les fonctions exportees
- Evaluer le niveau de risque (CRITICAL/HIGH/MEDIUM/LOW)
- Expliquer pourquoi c'est risque
```

#### 3.3 Qualite des tests existants

```
Pour chaque fichier de test, verifier:

- [ ] Tests flaky: if (today.getDate() ...) au lieu de vi.setSystemTime()
- [ ] Imports @prisma/client directs (echec sans prisma generate)
- [ ] Error paths testes: services avec try/catch ont mockRejectedValue
- [ ] Fonctions couvertes: comparer exports du service vs describes du test
- [ ] Mocks corrects: noms/signatures correspondent au code reel
```

#### 3.4 Couverture logique metier

```
Verifier que chaque regle metier critique a des tests:

| Regle Metier | Source | Tests attendus | Status |
|-------------|--------|----------------|--------|
| Releve immuable (pas d'UPDATE/DELETE) | Norme HACCP | Middleware Prisma | ? |
| Commentaire obligatoire si hors seuils | Regle metier | 400 sans commentaire | ? |
| 1 releve actif par (congelateur, date, creneau) | Contrainte unique | DB constraint + service | ? |
| Releve d'annulation pointe vers original avec motif | Workflow correction | Service annulation | ? |
| Salarie limite au jour courant | Permissions | Filtre date + role | ? |
| Timestamp/date generes serveur-side | Securite | Body ignore | ? |
| Alerte declenchee si hors seuils | Regle metier | Branche true/false | ? |
| Export CSV/PDF restreint Responsable/Admin | Permissions | 403 pour Salarie | ? |
| Permissions par role (Salarie/Responsable/Admin) | RBAC | Tests par role | ? |
| 3 creneaux (MATIN/MIDI/SOIR) | Domaine metier | Enum + UI | ? |
```

#### 3.5 Tests E2E et integration

```
Verifier:
- [ ] tests/e2e/ contient des tests Playwright
- [ ] Parcours critiques couverts: login Salarie, saisie releve OK/hors seuils, tentative modif releve (echec), export CSV Responsable, admin CRUD
- [ ] Tests de charge (K6) integres au CI ou standalone
```

### Format du rapport test coverage

Titre: `# Test Coverage Review - [branch/PR]`. Sections: Summary (source files count, test files count, estimated coverage %, suite results), Test Execution Results (failing suites table), Untested Files par priorite (P1 Core Services, P2 API/Middleware, P3 Validations, P4 Components/Hooks), Insufficient Coverage (existing tests with gaps), Test Quality Issues, Business Logic Coverage (tableau regle/status/gaps), E2E Coverage, Positive Findings, Recommendations par priorite (P0 Fix failing / P1 High / P2 Medium / P3 Lower).

---

## REGLES D'OR

1. **Lire le code** - Ne JAMAIS auditer sur la base des noms de fichiers seuls
2. **Executer les tests** - `npx prisma generate && npm test -- --run` avant analyse
3. **Auditer le diff** (main vs branch), pas juste l'etat actuel
4. **3 commentaires separes** - Un par axe (Securite, Performance, Tests)
5. **Severites**: CVSS pour securite, Critical/Major/Minor pour performance
6. **Preuves fichier:ligne** - Chaque finding cite le code exact
7. **Remediations concretes** avec code quand possible
8. **Documenter les positifs** - Reconnaitre ce qui est bien fait
9. **Penser attaquant** (securite), **echelle** (performance), **production** (tests)
10. **Ne JAMAIS dire "aucun probleme"** sans preuve detaillee de chaque verification
