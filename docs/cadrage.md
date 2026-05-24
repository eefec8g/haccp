# Note de Cadrage - Maison Givre HACCP

**Date** : 2026-05-24
**Statut** : Brouillon (en attente decisions critiques)
**Auteur** : Chef de projet (Claude) + Erkan

---

## 1. Contexte

Maison Givre est une **chaine de glaciers** (plusieurs boutiques). Chaque boutique exploite plusieurs equipements froid (congelateurs, vitrines refrigerees). La norme HACCP impose un releve regulier des temperatures pour garantir la securite alimentaire et tracer l'historique pour les controles sanitaires (DDPP, etc.).

Aujourd'hui les releves se font (vraisemblablement) sur papier ou pas du tout. On veut industrialiser ca avec une webapp interne.

## 2. Objectifs

| Objectif                      | Mesure de succes                                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Conformite HACCP**          | 100% des creneaux (matin/midi/soir) saisis par equipement, export audit < 1 min                          |
| **Gain de temps**             | < 10s par saisie de releve, < 2 min pour la tournee complete d'une boutique                              |
| **Reduction des pertes**      | Detection immediate des derives de temperature (alerte temps reel + email) avant que le stock soit perdu |
| **Excellence operationnelle** | Tracabilite immuable, registre exportable a tout moment                                                  |

## 3. Perimetre - Toutes fonctionnalites (sequencees en 3 releases)

> **Decision PM** : "Tout tout de suite + rapidement" est incompatible. On garde TOUT le scope mais on sequence. Releve quotidienne fonctionnel en v1.0, robustesse legale (signature, photo) en v1.1, qualite avancee en v2.

### v1.0 - MVP utilisable en boutique (objectif : ~2-3 semaines)

- Multi-boutique, multi-equipement (congelateur, vitrine, etc.)
- Comptes salarie / responsable / admin
- Saisie releve mobile (matin/midi/soir, par equipement)
- Detection alerte si hors seuils + commentaire obligatoire
- Dashboard du jour (creneaux faits / manquants / alertes)
- Historique pour responsable
- Export CSV/PDF par periode/boutique
- Notification mail aux responsables sur alerte

### v1.1 - Conformite legale renforcee (~1-2 semaines apres v1.0)

- Photo justificative obligatoire sur alerte (preuve)
- Signature electronique (a definir : par releve, par tournee, par registre journalier)
- Registre journalier consolide signe par le responsable
- Templates PDF d'export normalises pour audits DDPP

### v2.0 - Optimisation operationnelle (apres mise en prod stable)

- Stats avancees (tendances par equipement, derives lentes, predictif)
- Notifications SMS en plus du mail (optionnel)
- API ouverte si besoin d'integration (logiciel caisse, ERP...)
- Multi-langue si chaine internationale

## 4. Parties prenantes (RACI initial)

| Role                           | Personne              | Responsabilite                            |
| ------------------------------ | --------------------- | ----------------------------------------- |
| **Sponsor / decideur produit** | Erkan                 | A (decisions metier, validation releases) |
| **Chef de projet + dev**       | Claude (assistant IA) | R (coordination, dev, livraison)          |
| **Utilisateurs finaux**        | Salaries boutiques    | C/I (feedback usage terrain)              |
| **Utilisateurs operationnels** | Responsables boutique | C (validation workflows)                  |
| **Auditeurs externes**         | Inspecteurs DDPP      | I (consomment les exports)                |

## 5. Contraintes

- **Delai** : "rapidement" -> on vise v1.0 en 2-3 semaines de dev effectif
- **Stack imposee** : Next.js 15 + Prisma + PostgreSQL + NextAuth (heritee du setup Claude)
- **Budget hebergement** : a definir (decision critique #2)
- **Devices** : tablettes partagees boutique vs smartphones perso (decision critique #1)
- **Environnement** : boutique = froid, gants possibles, manipulation rapide -> UX ultra-simple obligatoire

## 6. Risques majeurs

| #   | Risque                                            | Proba      | Impact    | Mitigation                                                                 |
| --- | ------------------------------------------------- | ---------- | --------- | -------------------------------------------------------------------------- |
| R1  | **Saisie pas faite par les salaries** (adoption)  | Haute      | Tres haut | UX < 10s, gros boutons, rappel responsable, dashboard "creneaux manquants" |
| R2  | **Pas de wifi fiable en reserve/backstore**       | Moyenne    | Haut      | A trancher : PWA offline-first ou non (decision #3)                        |
| R3  | **Signature electronique non opposable en audit** | Moyenne    | Haut      | Documenter le process, horodatage + IP + user_id loggés, evolution v1.1    |
| R4  | **Falsification des releves** (saisie post-hoc)   | Moyenne    | Critique  | Releves IMMUABLES (deja dans CLAUDE.md), timestamp serveur, audit trail    |
| R5  | **Photos = stockage cher**                        | Moyenne    | Moyen     | Compression cote client, stockage S3/Vercel Blob, retention configurable   |
| R6  | **Scope creep "tout tout de suite"**              | Tres haute | Critique  | Releases v1.0 / v1.1 / v2 figees, refuser ajouts hors plan                 |

## 7. Planning macro (estimation)

- **Semaine 1** : CCF, US, Architecture, Setup technique (Next.js + Prisma + DB + Auth)
- **Semaine 2** : Dev v1.0 - Saisie releve, dashboard, multi-boutique
- **Semaine 3** : Dev v1.0 - Export, notifications mail, polish UX, tests E2E, deploy staging
- **Semaine 4** : Recette utilisateurs + corrections + deploy prod v1.0
- **Semaine 5-6** : v1.1 (photos, signature, registre journalier)
- **Apres** : v2 selon retours terrain

## 8. Criteres de succes (Definition of Done projet)

- [ ] Une boutique complete fait sa tournee matin/midi/soir sans aide pendant 1 semaine
- [ ] Un controle HACCP audit blanc passe avec l'export PDF genere
- [ ] 0 perte stock liee a une derive non detectee depuis la mise en service
- [ ] Temps moyen de saisie < 10 secondes
- [ ] 100% des creneaux saisis sur l'ensemble du parc

## 9. Decisions architecturales (verrouillees)

| #   | Decision          | Choix                                   | Implications                                                                                                        |
| --- | ----------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | **Auth + device** | Compte perso email/password (BYOD)      | NextAuth credentials, smartphones perso, RGPD : pas de cache releves cote client, session courte 30 min idle        |
| 2   | **Hebergement**   | Vercel + Neon Postgres                  | Deploy GitHub auto, Vercel Blob pour photos v1.1, ~0€ jusqu'a trafic modéré                                         |
| 3   | **Connectivite**  | Online uniquement                       | Pas de PWA offline en v1. Gestion explicite des erreurs reseau (toast "verifiez votre connexion")                   |
| 4   | **Signature**     | Numerique automatique par releve (v1.0) | userId + timestamp serveur + IP + hash contenu sur chaque releve. Canvas manuscrit reporte en v1.1 si exigence DDPP |
