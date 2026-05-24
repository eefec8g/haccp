# Workflow Git - HACCP Maison Givre

## 🌿 Structure des Branches

Ce projet utilise un **workflow Git Flow** avec 3 branches principales :

```
main (production)
  ↓
staging (pré-production)
  ↓
develop (développement)
  ↓
feature/* (fonctionnalités)
fix/* (corrections)
```

### Branches Principales

| Branche     | Rôle                   | Déploiement              | Protection       |
| ----------- | ---------------------- | ------------------------ | ---------------- |
| **main**    | Production stable      | Vercel Production        | ✅ Protégée      |
| **staging** | Pré-production / Tests | Vercel Preview (staging) | ✅ Protégée      |
| **develop** | Développement actif    | Vercel Preview (dev)     | ⚠️ Semi-protégée |

### Branches Temporaires

| Type     | Préfixe     | Exemple                   | Usage                           |
| -------- | ----------- | ------------------------- | ------------------------------- |
| Feature  | `feature/`  | `feature/user-auth`       | Nouvelles fonctionnalités       |
| Fix      | `fix/`      | `fix/login-redirect`      | Corrections de bugs             |
| Hotfix   | `hotfix/`   | `hotfix/security-patch`   | Corrections urgentes production |
| Refactor | `refactor/` | `refactor/database-layer` | Refactoring code                |

---

## 🚀 Workflow Complet

### 1. Développer une Nouvelle Fonctionnalité

```bash
# 1. Se placer sur develop
git checkout develop
git pull origin develop

# 2. Créer une branche feature
git checkout -b feature/nom-fonctionnalite

# 3. Développer et commiter régulièrement
git add .
git commit -m "feat: description de la fonctionnalité"

# 4. Pousser la branche
git push -u origin feature/nom-fonctionnalite

# 5. Créer une Pull Request vers develop
gh pr create --base develop --title "feat: Nom de la fonctionnalité" --body "Description détaillée"

# 6. Après review et merge, supprimer la branche locale
git checkout develop
git pull origin develop
git branch -d feature/nom-fonctionnalite
```

### 2. Corriger un Bug

```bash
# 1. Se placer sur develop
git checkout develop
git pull origin develop

# 2. Créer une branche fix
git checkout -b fix/nom-bug

# 3. Corriger et commiter
git add .
git commit -m "fix: correction du bug xyz"

# 4. Pousser et créer une PR vers develop
git push -u origin fix/nom-bug
gh pr create --base develop --title "fix: Nom du bug" --body "Description de la correction"
```

### 3. Déployer en Staging (Pré-Production)

```bash
# 1. Se placer sur staging
git checkout staging
git pull origin staging

# 2. Merger develop dans staging
git merge develop

# 3. Résoudre les conflits si nécessaire
# ... résolution de conflits ...

# 4. Pousser staging
git push origin staging

# ✅ Vercel déploie automatiquement sur l'environnement staging
# 🧪 Lancer les tests manuels / E2E sur staging

# 5. Si tout est OK, passer en production (étape 4)
# 6. Si problème, corriger sur develop et recommencer
```

### 4. Déployer en Production

```bash
# 1. Se placer sur main
git checkout main
git pull origin main

# 2. Merger staging dans main
git merge staging

# 3. Créer un tag de version
git tag -a v1.0.0 -m "Release v1.0.0 - Description"

# 4. Pousser main + tags
git push origin main --tags

# ✅ Vercel déploie automatiquement en production
# 📊 Surveiller les logs / métriques

# 5. Synchroniser develop avec main
git checkout develop
git merge main
git push origin develop
```

### 5. Hotfix Urgent en Production

```bash
# 1. Créer une branche hotfix depuis main
git checkout main
git pull origin main
git checkout -b hotfix/nom-correction

# 2. Corriger le problème
git add .
git commit -m "hotfix: correction urgente xyz"

# 3. Pousser et créer une PR vers main
git push -u origin hotfix/nom-correction
gh pr create --base main --title "hotfix: Correction urgente" --body "Description du problème et de la solution"

# 4. Après merge dans main, merger également dans staging et develop
git checkout staging
git merge main
git push origin staging

git checkout develop
git merge main
git push origin develop

# 5. Supprimer la branche hotfix
git branch -d hotfix/nom-correction
git push origin --delete hotfix/nom-correction
```

---

## 📋 Conventions de Commit

Suivre la convention **Conventional Commits** :

```
<type>(<scope>): <description courte>

[corps optionnel]

[footer optionnel]
```

### Types

| Type       | Usage                          | Exemple                               |
| ---------- | ------------------------------ | ------------------------------------- |
| `feat`     | Nouvelle fonctionnalité        | `feat: add user authentication`       |
| `fix`      | Correction de bug              | `fix: resolve login redirect issue`   |
| `docs`     | Documentation uniquement       | `docs: update README with setup`      |
| `style`    | Formatting, missing semicolons | `style: format code with prettier`    |
| `refactor` | Refactoring code               | `refactor: simplify Button component` |
| `perf`     | Amélioration performance       | `perf: optimize database queries`     |
| `test`     | Ajout/modification tests       | `test: add unit tests for auth`       |
| `chore`    | Maintenance, dépendances       | `chore: update dependencies`          |
| `ci`       | CI/CD modifications            | `ci: add deployment workflow`         |

### Exemples de Commits

```bash
# Bons commits
git commit -m "feat: add client creation form with validation"
git commit -m "fix: resolve infinite loop in useEffect hook"
git commit -m "refactor: extract database logic to repository layer"
git commit -m "docs: add API documentation for auth endpoints"

# Mauvais commits (à éviter)
git commit -m "update"
git commit -m "fix bug"
git commit -m "work in progress"
git commit -m "asdf"
```

---

## 🔒 Protection des Branches

### Sur GitHub

Configurer les protections pour `main` et `staging` :

1. Aller dans **Settings** → **Branches** → **Add rule**
2. Branch name pattern : `main`
3. Cocher :
   - ✅ Require pull request before merging
   - ✅ Require approvals (1 minimum)
   - ✅ Require status checks to pass (CI)
   - ✅ Require conversation resolution
   - ✅ Include administrators

4. Répéter pour `staging`

### Résultat

- ❌ **Impossible de pousser directement** sur `main` ou `staging`
- ✅ **Obligé de passer par Pull Request** avec review
- ✅ **CI doit passer** avant merge (tests, lint, build)

---

## 🎯 Récapitulatif des Commandes

### Setup Initial (une fois)

```bash
# Cloner le projet
git clone https://github.com/<username>/haccp.git
cd haccp

# Récupérer toutes les branches
git fetch --all

# Se placer sur develop
git checkout develop
```

### Quotidien

```bash
# Commencer une nouvelle feature
git checkout develop
git pull origin develop
git checkout -b feature/ma-feature

# Commiter régulièrement
git add .
git commit -m "feat: description"

# Pousser et créer PR
git push -u origin feature/ma-feature
gh pr create --base develop

# Mettre à jour sa branche avec develop
git checkout feature/ma-feature
git pull origin develop
git push
```

### Synchronisation

```bash
# Mettre à jour develop
git checkout develop
git pull origin develop

# Mettre à jour staging
git checkout staging
git pull origin staging

# Mettre à jour main
git checkout main
git pull origin main
```

---

## 📊 Cycle de Release

```
1. Développement sur develop
   ↓ (merge features)
2. Tests internes
   ↓ (si OK)
3. Merge develop → staging
   ↓
4. Tests pré-production sur staging
   ↓ (si OK)
5. Merge staging → main
   ↓
6. Déploiement production
   ↓
7. Tag version (v1.0.0)
   ↓
8. Synchroniser develop avec main
```

**Fréquence recommandée** :

- `develop` → `staging` : **Chaque semaine** (vendredi)
- `staging` → `main` : **Toutes les 2-4 semaines** (après validation QA)

---

## 🔄 Workflow Epic (développement par Epic)

Le développement se fait par **Epic** (ensemble de User Stories liées). Chaque Epic suit ce cycle :

```
develop (à jour)
  ↓ git checkout -b epic<N>
epic<N> (développement)
  ↓ PR epic<N> → develop
develop (avec les changements)
  ↓ PR develop → main
main (production)
  ↓ synchronisation
develop (à jour = main)
```

### Créer une branche Epic

```bash
# TOUJOURS partir de develop à jour
git checkout develop
git pull origin develop

# Créer la branche epic
git checkout -b epic<N>
```

### Terminer une Epic (après tous les audits PASS)

```bash
# 1. Pousser la branche epic
git push -u origin epic<N>

# 2. Créer PR epic → develop
gh pr create --base develop --title "Epic <N>: <titre>"

# 3. Après merge, créer PR develop → main
git checkout develop && git pull origin develop
gh pr create --base main --head develop --title "Merge develop: Epic <N>"
```

### Synchroniser après merge (OBLIGATOIRE)

**Après merge de develop → main**, synchroniser develop pour éliminer les merge commits de retard :

```bash
# 1. Mettre à jour main
git checkout main && git pull origin main

# 2. Synchroniser develop avec main
git checkout develop && git pull origin develop && git merge main --no-edit

# 3. Pousser develop synchronisé
git push origin develop

# 4. Vérifier : 0 commit de retard
git rev-list --left-right --count origin/main...origin/develop
# Doit afficher : 0    0
```

> **Pourquoi ?** GitHub crée des merge commits lors des PR. Sans cette synchro, `develop` accumule du retard sur `main` et le prochain epic part d'un état désynchronisé.

### Nettoyage

```bash
# Supprimer la branche epic (locale + remote)
git branch -d epic<N>
git push origin --delete epic<N>
```

---

## 🚨 En Cas de Problème

### Conflit lors du merge

```bash
# 1. Identifier les fichiers en conflit
git status

# 2. Éditer les fichiers et résoudre les conflits
# Chercher les marqueurs <<<<<<< ======= >>>>>>>

# 3. Marquer comme résolu
git add <fichier-résolu>

# 4. Finaliser le merge
git commit -m "merge: resolve conflicts"
git push
```

### Annuler un commit (avant push)

```bash
# Annuler le dernier commit (garder les modifications)
git reset --soft HEAD~1

# Annuler le dernier commit (supprimer les modifications)
git reset --hard HEAD~1
```

### Annuler un push (dangereux !)

```bash
# ⚠️ À utiliser UNIQUEMENT sur des branches personnelles
git reset --hard HEAD~1
git push --force origin feature/ma-feature

# ❌ JAMAIS sur main, staging, ou develop !
```

### Récupérer une branche supprimée

```bash
# Lister les références perdues
git reflog

# Récupérer la branche
git checkout -b feature/ma-feature <commit-hash>
```

---

## 📱 Récupération sur Portable

### Première fois

```bash
# 1. Cloner
git clone https://github.com/<username>/haccp.git
cd haccp

# 2. Installer
npm install

# 3. Configurer
cp .env.example .env.local
# Éditer .env.local

# 4. Setup DB
npm run db:push

# 5. Se placer sur develop
git checkout develop
```

### Ensuite

```bash
# Récupérer les dernières modifications
git checkout develop
git pull origin develop

# Ou sur une branche spécifique
git checkout feature/ma-feature
git pull origin feature/ma-feature
```

---

## ✅ Checklist Pull Request

Avant de créer une PR, vérifier :

- [ ] Le code compile sans erreur (`npm run build`)
- [ ] Les tests passent (`npm test`)
- [ ] Le linting passe (`npm run lint`)
- [ ] Les types TypeScript sont corrects (`npm run type-check`)
- [ ] Le code est formaté (`npm run format`)
- [ ] La documentation est à jour si nécessaire
- [ ] Les commits suivent la convention (feat:, fix:, etc.)
- [ ] La description de la PR est claire et détaillée
- [ ] Les captures d'écran sont ajoutées si changements UI

---

## 🎓 Ressources

- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Flow](https://docs.github.com/en/get-started/quickstart/github-flow)
- [Semantic Versioning](https://semver.org/)

---

**⚠️ RÈGLE D'OR** : Ne JAMAIS pousser directement sur `main` ou `staging`. Toujours passer par Pull Request avec review !
