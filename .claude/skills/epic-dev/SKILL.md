---
name: epic-dev
description: |
  Epic Dev Workflow - Workflow de developpement par Epic.
  Architecture token-optimisee : orchestrateur maigre + agents lourds.
  Etat persiste sur disque pour reprise apres crash.

  AUTOMATIC TRIGGERS:
  - User demande de "developper l'epic X", "epic dev", "lancer l'epic"
  - User mentionne "workflow epic", "dev par epic"

  MANUAL TRIGGERS:
  - /epic-dev 2
  - /epic-dev --epic=3
  - /epic-dev --epic=2 --us=US-014 (reprendre a une US specifique)

argument-hint: '<numero-epic> [--us=US-XXX]'
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, Task
---

# Epic Dev Workflow - Orchestrateur Token-Optimise

Tu es un **orchestrateur maigre** : tu coordonnes, tu delegues, tu verifies. Tu ne lis JAMAIS de code source toi-meme.

## Epic demandee

$ARGUMENTS

---

## PRINCIPE FONDAMENTAL : ORCHESTRATEUR MAIGRE, AGENTS LOURDS

| Regle                                                | Detail                                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **L'orchestrateur ne lit JAMAIS de fichiers source** | Lire un fichier = 200-2000 lignes dans le contexte pour rien. Deleguer aux agents.  |
| **Etat persiste sur disque**                         | Fichier `.claude/epic-state.md` — pas dans le contexte conversationnel              |
| **Prompts agents auto-suffisants**                   | Chaque agent recoit TOUT ce qu'il faut dans son prompt (US body, chemins, patterns) |
| **Resultats agents = resume court**                  | L'agent retourne "X fichiers crees, tests OK/KO" — jamais le code entier            |
| **Batches de 2-3 US max**                            | Meme les resumes s'accumulent — on purge entre batches                              |
| **Verification = commandes**                         | `npm run type-check && npm test` = pass/fail, pas de lecture de code                |

---

## REPRISE APRES CRASH

**TOUJOURS commencer par verifier si `.claude/epic-state.md` existe.**

```bash
cat .claude/epic-state.md 2>/dev/null || echo "NO_STATE"
```

- Si `NO_STATE` → demarrer a la Phase 0
- Si le fichier existe → lire la derniere phase completee et reprendre a la suivante
- L'argument `--us=US-XXX` force la reprise a une US specifique dans la Phase 2

---

## PHASE 0 : ANALYSE & PLAN (1 agent Explore)

**Objectif** : Comprendre TOUTES les US, identifier les modules communs, produire le plan sur disque. L'orchestrateur ne recoit qu'un resume.

### 0.1 Lancer l'agent d'analyse

```
Task(subagent_type=Explore, description="Analyse Epic N")
```

**Prompt de l'agent** (inclure integralement) :

> Thoroughness: very thorough
>
> Tu analyses l'Epic <N> pour produire un plan de developpement.
>
> ETAPE 1 — Lire les US :
>
> ```bash
> gh issue list --label "epic-<N>" --state all --json number,title,state,body
> ```
>
> Pour chaque US : noter CA, taches, regles metier, dependances.
>
> ETAPE 2 — Scanner le code existant :
>
> - `prisma/schema.prisma` (modeles concernes)
> - `src/components/ui/` (composants existants a reutiliser)
> - `src/features/` (features existantes)
> - `src/lib/services/`, `src/lib/validations/`, `src/types/`
> - `docs/CCF.md` (regles metier source de verite)
>
> ETAPE 3 — Analyse transversale :
> En lisant TOUTES les US ensemble, identifier :
>
> - Modules communs (types, Zod, services, constants, utils) utilises par 2+ US
> - Composants UI existants a reutiliser (NE PAS dupliquer)
> - Dependances entre US (graphe)
> - Batches de 2-3 US independantes pour parallelisation
>
> ETAPE 4 — Ecrire le plan sur disque :
> Ecrire le fichier `.claude/epic-state.md` avec la structure suivante (utiliser Write tool) :
>
> ```markdown
> # Epic <N> - State
>
> ## Status: PHASE_0_DONE
>
> ## US List
>
> | #   | Titre | Points | Priorite | Deps | Batch | Status |
> | --- | ----- | ------ | -------- | ---- | ----- | ------ |
>
> (une ligne par US, Status = pending)
>
> ## Modules Communs (a coder en Phase 1)
>
> ### Schema Prisma
>
> (modifications necessaires)
>
> ### Types (`src/types/`)
>
> (types a creer, + US utilisatrices)
>
> ### Constants (`src/lib/constants/`)
>
> (constantes a creer)
>
> ### Schemas Zod (`src/lib/validations/`)
>
> (schemas a creer)
>
> ### Utils (`src/lib/utils/`)
>
> (utils a creer)
>
> ### Services (`src/lib/services/`)
>
> (services partages a creer)
>
> ### Composants UI (`src/features/`)
>
> (composants partages a creer)
>
> ## Composants Existants a Reutiliser
>
> (liste des composants dans @/components/ui deja disponibles)
>
> ## Batches de Dev (Phase 2)
>
> - Batch 1 : US-XXX, US-YYY (independantes, parallelisables)
> - Batch 2 : US-ZZZ (depend de Batch 1)
> - ...
>
> ## Log
>
> - [date] Phase 0 complete
> ```
>
> ETAPE 5 — Retourner un resume (20 lignes MAX) :
>
> - Nombre total d'US (ouvertes/fermees)
> - Modules communs identifies (juste les noms, pas le detail)
> - Nombre de batches
> - Risques/questions pour le user

### 0.2 Presenter le plan au user

Afficher le resume de l'agent + demander validation :

- Lire UNIQUEMENT la section "Batches" et "Modules Communs" du fichier `.claude/epic-state.md`
- Presenter sous forme de tableau concis
- **ATTENDRE la validation du user avant Phase 1**

---

## PHASE 1 : SOCLE COMMUN (1 agent senior-dev)

**Objectif** : Coder TOUS les modules partages AVANT les US individuelles. DRY by design.

### 1.1 Lancer l'agent socle commun

```
Task(subagent_type=senior-dev, description="Socle commun Epic N")
```

**Prompt de l'agent** (inclure integralement) :

> Tu developpes le socle commun de l'Epic <N>.
>
> CONTEXTE : Lire le fichier `.claude/epic-state.md` pour le plan complet.
> Lire aussi `CLAUDE.md` pour les conventions et `docs/CCF.md` pour les regles metier.
>
> ORDRE DE DEV (strict) :
>
> 1. Schema Prisma (`prisma/schema.prisma`) + `npx prisma generate`
> 2. Types TypeScript (`src/types/`)
> 3. Constants (`src/lib/constants/`)
> 4. Schemas Zod (`src/lib/validations/`)
> 5. Utils (`src/lib/utils/`)
> 6. Services partages (`src/lib/services/`)
> 7. Composants UI partages (`src/features/` ou `src/components/`)
> 8. Tests unitaires pour chaque module
>
> REGLES CLEAN CODE :
>
> - Server Components par defaut, `'use client'` seulement si hooks/events/browser APIs
> - Imports absolus : `@/components/ui`, `@/lib/prisma`
> - Fonctions SRP, <20 lignes, max 2 args
> - Pas de `any`/`as` sans type guard
> - `data-testid` sur elements interactifs
> - `const`, spread, readonly (immutabilite)
> - Apres chaque fichier ecrit/edite : `npx prettier --write <fichier>`
>
> VERIFICATION FINALE :
>
> ```bash
> npm run format:check && npm run type-check && npm run lint && npm run build && npm test -- --run
> ```
>
> Si un check echoue → corriger et re-run.
>
> RETOUR (resume court) :
>
> - Liste des fichiers crees/modifies (chemins uniquement)
> - Resultat des checks (pass/fail)
> - Problemes rencontres

### 1.2 Verifier (orchestrateur)

```bash
npm run type-check && npm test -- --run
```

- Si PASS → mettre a jour `.claude/epic-state.md` : `Status: PHASE_1_DONE`
- Si FAIL → relancer un agent senior-dev pour corriger (lui donner l'erreur exacte)

---

## PHASE 2 : DEV DES US PAR BATCH (agents senior-dev paralleles)

**Objectif** : Developper les US par batches de 2-3, en parallele quand independantes.

### 2.1 Pour chaque batch

Lire la section "Batches" de `.claude/epic-state.md`.

Pour chaque US du batch, lancer un agent `senior-dev` en parallele :

```
Task(subagent_type=senior-dev, description="US-XXX: <titre court>")
```

**Prompt de l'agent** (template — adapter par US) :

> Tu developpes la **US-XXX : <titre>**.
>
> CONTEXTE :
>
> - Lire l'issue GitHub : `gh issue view <numero> --json body`
> - Lire le plan : `.claude/epic-state.md`
> - Lire les conventions : `CLAUDE.md`
> - Lire les regles metier : `docs/CCF.md`
>
> MODULES COMMUNS DISPONIBLES (Phase 1, deja codes) :
> <lister ici les chemins des modules communs pertinents pour cette US>
> → Les IMPORTER, ne PAS les re-creer.
>
> ORDRE DE DEV :
>
> 1. Types specifiques a cette US
> 2. Schema Zod specifique
> 3. Repository (si necessaire)
> 4. Service
> 5. API Route(s)
> 6. Page / Feature components
> 7. Tests unitaires
>
> FICHIERS AUTORISES (cette US uniquement) :
> <lister les fichiers que cet agent peut creer/modifier>
> NE PAS modifier de fichier en dehors de cette liste.
> Si un module commun doit etre modifie → le signaler dans le retour.
>
> REGLES CLEAN CODE : (memes que Phase 1)
>
> - Server Components par defaut
> - Imports absolus, fonctions SRP <20 lignes, max 2 args
> - Pas de `any`/`as`, `data-testid`, immutabilite
> - `npx prettier --write <fichier>` apres chaque ecriture
>
> VERIFICATION :
>
> ```bash
> npm run type-check && npm test -- --run
> ```
>
> RETOUR (resume court) :
>
> - Fichiers crees/modifies (chemins)
> - Checks pass/fail
> - Module commun a modifier ? (signaler)

### 2.2 Verifier le batch (orchestrateur)

```bash
npm run format:check && npm run type-check && npm run lint && npm run build && npm test -- --run
```

- Si PASS → mettre a jour `.claude/epic-state.md` : status de chaque US du batch → `done`
- Si FAIL → lancer un agent senior-dev de correction avec l'erreur exacte
- **Passer au batch suivant seulement quand le batch courant est PASS**

### 2.3 Repeter pour chaque batch

Quand tous les batches sont termines → mettre a jour : `Status: PHASE_2_DONE`

---

## PHASE 3 : AUDITS QUALITE (agents specialises paralleles)

**Objectif** : Valider la qualite avant tout commit. Corrections AVANT commit = commits propres.

### 3.1 Checks globaux (orchestrateur)

```bash
npm run format:check && npm run type-check && npm run lint && npm run build && npm test -- --run
```

**Tous les checks doivent passer AVANT les audits.**

### 3.2 Audits paralleles (4 agents en //)

Lancer simultanement :

| Agent       | Type                   | Focus                                                 |
| ----------- | ---------------------- | ----------------------------------------------------- |
| Clean Code  | `clean-code-reviewer`  | 10 criteres CLAUDE.md, score detaille par critere     |
| Security    | `security-engineer`    | OWASP Top 10, multi-tenant, auth/authz, secrets, Zod  |
| Performance | `performance-engineer` | N+1, index, findMany sans take, bundle, serverless    |
| Use Client  | `senior-dev`           | Pages 'use client', useSession→auth(), useRouter→Link |

**Prompt type pour chaque audit** :

> Tu audites le code de l'Epic <N> sur l'axe <AXE>.
> Lire `.claude/epic-state.md` pour la liste des fichiers crees/modifies.
> Lire `CLAUDE.md` pour les criteres de review.
> Scanner uniquement les fichiers listes dans l'epic-state.
> RETOUR : PASS ou FAIL + liste des problemes par severite (Critical/Major/Minor)

### 3.3 Audits sequentiels (apres corrections des //)

- **Business Logic** (`business-logic-reviewer`) : conformite CCF, CA vs code, tracabilite
- **Test Coverage** (`qa-tester`) : execution, inventaire, couverture >80%, error paths

### 3.4 Boucle de correction

Si un audit FAIL :

1. Lancer un agent `senior-dev` avec la liste exacte des corrections
2. Re-run checks : `npm run type-check && npm test -- --run`
3. Re-run uniquement les audits concernes
4. Iterer jusqu'a TOUS PASS

Mettre a jour : `Status: PHASE_3_DONE`

---

## PHASE 4 : COMMITS PAR US (orchestrateur seul)

**Tous les audits PASS.** L'orchestrateur fait les commits — pas d'agent necessaire.

### 4.1 Un commit par US

Pour chaque US dans l'ordre de dev :

```bash
git add <fichiers de cette US>
git commit -m "$(cat <<'EOF'
feat(US-XXX): <titre de l'US>

<description courte des changements>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

**Fichiers partages** → inclure dans le commit de la **premiere US qui les introduit**.

### 4.2 Verifier

```bash
git log --oneline -<N>  # N = nombre d'US
```

Mettre a jour : `Status: PHASE_4_DONE`

---

## PHASE 5 : FERMETURE DES ISSUES (orchestrateur seul)

```bash
gh issue close <numero> --comment "Implementee et validee (tous audits PASS) dans la branche <branch>.
Commits: <liste des sha courts>"
```

Mettre a jour : `Status: PHASE_5_DONE`

---

## PHASE 6 : FIN D'EPIC

### 6.1 Resume final

Presenter au user :

| US  | Titre | Commit | Status |
| --- | ----- | ------ | ------ |

| Audit          | Resultat           |
| -------------- | ------------------ |
| Clean Code     | score detaille /10 |
| Security       | PASS/FAIL          |
| Performance    | PASS/FAIL          |
| Business Logic | PASS/FAIL          |
| Test Coverage  | >80%               |
| Use Client     | PASS/FAIL          |

### 6.2 PR et merge

- Push la branche epic : `git push -u origin epic<N>`
- Creer PR epic → develop : `gh pr create --base develop`
- Apres merge dans develop, creer PR develop → main : `gh pr create --base main --head develop`

### 6.3 Synchronisation des branches (OBLIGATOIRE)

**Apres merge de la PR develop → main**, synchroniser develop pour que le prochain epic parte propre :

```bash
# 1. Mettre a jour main
git checkout main && git pull origin main

# 2. Synchroniser develop avec main (recupere les merge commits)
git checkout develop && git pull origin develop && git merge main --no-edit

# 3. Pousser develop synchronise
git push origin develop

# 4. Verifier : 0 commit de retard
git rev-list --left-right --count origin/main...origin/develop
# Doit afficher : 0    0
```

**Pourquoi ?** GitHub cree des merge commits lors des PR. Sans synchro, develop accumule du retard sur main, et le prochain epic part d'un etat desynchronise.

### 6.4 Nettoyage

```bash
# Supprimer la branche epic locale et remote
git branch -d epic<N>
git push origin --delete epic<N>

# Supprimer le fichier d'etat
rm .claude/epic-state.md
```

### 6.5 Proposer la suite

- Proposer l'epic suivante
- Le user peut creer la branche depuis develop : `git checkout develop && git checkout -b epic<N+1>`

Mettre a jour : `Status: EPIC_DONE`

---

## REGLES D'OR

1. **L'orchestrateur ne lit JAMAIS de fichiers source** — deleguer aux agents
2. **Etat sur disque** (`.claude/epic-state.md`) — pas dans le contexte
3. **JAMAIS coder avant Phase 0 complete** + validation user
4. **JAMAIS commiter avant TOUS les audits PASS**
5. **UN commit par US** — granulaire, facilite les reverts
6. **DRY by design** — Phase 1 (socle commun) AVANT Phase 2 (US)
7. **Batches de 2-3 US max** — purger le contexte entre batches
8. **Prompts agents auto-suffisants** — tout le contexte dans le prompt
9. **Resultats agents = resume court** — jamais le code entier
10. **Verification = commandes** — `npm run type-check && npm test` = pass/fail
11. **JAMAIS dire "Clean Code 10/10"** sans preuve detaillee par critere
12. **TOUJOURS attendre validation user** avant de commencer le dev
