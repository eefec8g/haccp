# CCF - Cahier des Charges Fonctionnel - Maison Givre HACCP

**Version** : 1.0 (v1.0 release)
**Date** : 2026-05-24
**Source de verite metier** referencee dans `CLAUDE.md`

---

## 1. Glossaire

| Terme                   | Definition                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| **HACCP**               | Hazard Analysis Critical Control Point - methodologie obligatoire de maitrise des risques sanitaires |
| **Boutique**            | Point de vente physique (ex: "Maison Givre Paris 11", "MG Lyon Part-Dieu")                           |
| **Equipement**          | Materiel froid soumis a releve : congelateur, vitrine refrigeree, chambre froide, etc.               |
| **Releve**              | Mesure de temperature instantanee (equipement, creneau, valeur, salarie, timestamp)                  |
| **Creneau**             | Moment de la journee impose : MATIN, MIDI, SOIR                                                      |
| **Seuil**               | Plage de temperature admissible (`min`, `max`) - varie selon type d'equipement                       |
| **Alerte**              | Releve dont la temperature est hors seuils (declenche commentaire obligatoire + notification)        |
| **Signature numerique** | Empreinte cryptographique (userId + timestamp serveur + IP + hash) attachee a chaque releve          |
| **Registre journalier** | Synthese consolidee par boutique/jour : liste des releves + alertes + commentaires                   |
| **Audit DDPP**          | Controle sanitaire par la Direction Departementale de la Protection des Populations                  |

## 2. Acteurs et droits

| Acteur          | Description                         | Droits                                                                                                            |
| --------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Salarie**     | Personnel boutique                  | Saisir releves, voir tournee du jour de SA boutique, voir SES propres releves passes                              |
| **Responsable** | Manager de 1 ou plusieurs boutiques | Tout du Salarie + lecture historique complete de SES boutiques + exports + gestion alertes + recoit emails alerte |
| **Admin**       | Direction Maison Givre              | Tout + CRUD boutiques + CRUD equipements + CRUD utilisateurs + parametres globaux                                 |

> **Important** : un Salarie est rattache a 1 boutique. Un Responsable peut etre rattache a N boutiques. Un Admin voit tout le parc.

## 3. Exigences fonctionnelles par module

### 3.1 Module Authentification

| Ref         | Exigence                                             |
| ----------- | ---------------------------------------------------- |
| EX-AUTH-001 | Un utilisateur se connecte avec email + mot de passe |
| EX-AUTH-002 | Reinitialisation du mot de passe par email           |
| EX-AUTH-003 | Session 30 min d'inactivite max (revoquee au-dela)   |
| EX-AUTH-004 | Rate limiting : 5 tentatives login / 15 min / IP     |
| EX-AUTH-005 | Mots de passe stockes hashes (bcrypt rounds >= 12)   |
| EX-AUTH-006 | Logout invalide la session cote serveur              |

### 3.2 Module Boutique (Admin)

| Ref        | Exigence                                                                             |
| ---------- | ------------------------------------------------------------------------------------ |
| EX-BOU-001 | Admin peut creer/modifier/desactiver une boutique (nom, adresse, ville)              |
| EX-BOU-002 | Une boutique desactivee est masquee mais conservee (releves historiques accessibles) |
| EX-BOU-003 | Une boutique a une liste d'equipements et une liste d'utilisateurs rattaches         |

### 3.3 Module Equipement (Admin)

| Ref        | Exigence                                                                                                                                                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EX-EQP-001 | Un equipement = (nom, type, boutique, seuil_min, seuil_max, actif)                                                                                                                                                                                                                       |
| EX-EQP-002 | Types : `CONGELATEUR`, `VITRINE`, `CHAMBRE_FROIDE`, `AUTRE`. Les seuils min/max sont **OBLIGATOIRES** a la saisie ; aucune valeur par defaut n'est appliquee automatiquement. (Decision technique 2026-05-24, voir `.claude/epic-state.md` #4. Anciennement : defaults seuils par type.) |
| EX-EQP-003 | Seuils modifiables par equipement (a la creation et via update)                                                                                                                                                                                                                          |
| EX-EQP-004 | Un equipement desactive disparait des tournees mais conserve son historique                                                                                                                                                                                                              |

### 3.4 Module Releve (coeur metier)

| Ref        | Exigence                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| EX-REL-001 | Un Salarie saisit (equipement, creneau, temperature) - sa boutique est deduite de son compte                             |
| EX-REL-002 | La date et le timestamp sont generes SERVEUR-SIDE (jamais accepter du client)                                            |
| EX-REL-003 | Un releve est IMMUABLE : aucune route API ne permet UPDATE/DELETE                                                        |
| EX-REL-004 | Correction = nouveau releve `annule_par_id` pointant vers l'original + motif obligatoire                                 |
| EX-REL-005 | Contrainte unique : 1 seul releve ACTIF par (equipement, date, creneau) - les annules ne comptent pas                    |
| EX-REL-006 | Si temperature < seuil_min OU temperature > seuil_max : commentaire obligatoire (refus 400 sinon)                        |
| EX-REL-007 | Chaque releve porte une signature numerique : `userId + serverTimestamp + IP + sha256(equipementId+creneau+temperature)` |
| EX-REL-008 | Le creneau MATIN est saisissable entre 5h-12h, MIDI entre 11h-16h, SOIR entre 16h-23h (avec tolerance configurable)      |

### 3.5 Module Alerte

| Ref        | Exigence                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------- |
| EX-ALE-001 | Un releve hors seuils cree automatiquement une Alerte (status OUVERTE)                        |
| EX-ALE-002 | Une notification email est envoyee aux Responsables de la boutique concernee (dans la minute) |
| EX-ALE-003 | Un Responsable peut RESOLVE une alerte avec commentaire (cause + action corrective)           |
| EX-ALE-004 | Une alerte peut etre marquee IGNOREE (faux positif) avec justification                        |
| EX-ALE-005 | Une alerte non resolue apparait en tete du dashboard responsable                              |

### 3.6 Module Dashboard

| Ref        | Exigence                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| EX-DAS-001 | **Salarie** : tournee du jour = grille (equipements x 3 creneaux) avec status FAIT / MANQUANT / EN ALERTE |
| EX-DAS-002 | **Responsable** : vue consolidee SES boutiques + alertes ouvertes + completude du jour (% releves faits)  |
| EX-DAS-003 | **Admin** : vue parc complet + KPIs (boutiques, equipements, alertes 7j, taux completude)                 |

### 3.7 Module Export

| Ref        | Exigence                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------- |
| EX-EXP-001 | Export CSV : releves d'une periode et/ou boutique et/ou equipement                                |
| EX-EXP-002 | Export PDF : registre journalier d'une boutique a une date donnee (format presentable audit DDPP) |
| EX-EXP-003 | Export accessible uniquement aux Responsable (sur SES boutiques) et Admin (toutes)                |
| EX-EXP-004 | Export inclut signature numerique de chaque releve (preuve d'integrite)                           |

### 3.8 Module Notifications

| Ref        | Exigence                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------- |
| EX-NOT-001 | Notification email aux Responsables sur alerte (temps reel < 1 min)                         |
| EX-NOT-002 | Notification email recap quotidien aux Responsables : completude J-1 + alertes non resolues |
| EX-NOT-003 | Service mail : Resend (recommande Vercel) ou SMTP custom                                    |

## 4. Regles de gestion (RG)

### RG-IMMU-001 - Immutabilite des releves

**Priorite** : Obligatoire
**Description** : Un releve, une fois cree, ne peut pas etre modifie ni supprime.
**Condition** : SI tentative UPDATE/DELETE sur Releve ALORS rejet (middleware Prisma) SINON release OK.
**Exception** : Aucune. Meme Admin ne peut pas modifier.
**Justification** : Preuve sanitaire opposable, valeur juridique pour audit.

### RG-SEUIL-001 - Detection hors seuils

**Priorite** : Obligatoire
**Description** : Un releve est en alerte si `temperature < seuil_min` OU `temperature > seuil_max`.
**Condition** : Comparaison STRICTE (bornes incluses dans la plage = OK).
**Exemple** : seuils [-25, -18] -> -18.0 est OK, -17.9 est en ALERTE.

### RG-COMM-001 - Commentaire obligatoire sur alerte

**Priorite** : Obligatoire
**Description** : Si releve hors seuils, le champ `commentaire` doit etre rempli (>= 10 caracteres).
**Condition** : SI alerte ET commentaire vide/court ALORS HTTP 400.

### RG-CREN-001 - Unicite du releve actif

**Priorite** : Obligatoire
**Description** : Un seul releve ACTIF par (equipement, date, creneau).
**Exception** : Plusieurs releves annules peuvent exister (historique des corrections).

### RG-PERM-001 - Cloisonnement par boutique

**Priorite** : Obligatoire
**Description** : Un Salarie ne voit QUE les equipements/releves de SA boutique. Un Responsable QUE de SES boutiques.
**Condition** : Toutes les requetes service filtrent par `boutiqueId IN (boutiques accessibles a session.user)`.

### RG-LECT-001 - Historique limite pour Salarie

**Priorite** : Obligatoire
**Description** : Le Salarie ne lit l'historique que sur les 7 derniers jours (configurable).
**Condition** : Filtre `date >= today - 7d` cote service quand `role === SALARIE`.

### RG-SIGN-001 - Signature numerique

**Priorite** : Obligatoire
**Description** : Chaque releve porte une chaine `signature` calculee a la creation, non modifiable.
**Formule** : `sha256(userId || serverTimestamp || ip || equipementId || creneau || temperature || commentaire)`

## 5. Processus metier (BPMN simplifie)

### Processus : Saisie releve

```
[Debut] -> [Salarie ouvre l'app] -> [Liste equipements du jour]
       -> [Salarie selectionne equipement+creneau]
       -> [Saisie temperature] -> <decision> hors seuils ?
                                    | OUI -> [Saisie commentaire obligatoire] -> [Validation]
                                    | NON -> [Validation directe]
       -> [Serveur calcule signature + cree Releve]
       -> <decision> hors seuils ?
                                    | OUI -> [Cree Alerte] -> [Envoi mail Responsables]
                                    | NON -> (rien)
       -> [Retour grille tournee mise a jour] -> [Fin]
```

### Processus : Correction d'un releve errone

```
[Debut] -> [Responsable repere releve errone (ex: typo)]
       -> [Cree nouveau releve "annulation"] (motif + nouvelle valeur)
       -> [Serveur lie annule_par_id -> releve original]
       -> [Releve original reste en DB mais "annule"] -> [Fin]
```

## 6. Exigences non fonctionnelles

| #     | Categorie     | Exigence                   | Objectif                                                                         |
| ----- | ------------- | -------------------------- | -------------------------------------------------------------------------------- |
| ENF-1 | Performance   | Saisie releve              | < 10s du lancement de l'app a la confirmation                                    |
| ENF-2 | Performance   | Chargement tournee du jour | < 2s sur 4G                                                                      |
| ENF-3 | Disponibilite | Uptime SaaS                | 99.5% (suffisant pour usage interne)                                             |
| ENF-4 | Securite      | Releves immuables          | 0 chemin technique permettant UPDATE/DELETE                                      |
| ENF-5 | Securite      | RGPD                       | Releves stockes 5 ans (obligation audit), comptes purges 30j apres desactivation |
| ENF-6 | UX            | Accessibilite              | WCAG AA, touch targets >= 56px (gants), contraste eleve                          |
| ENF-7 | Compatibilite | Mobile                     | iOS Safari 16+ / Chrome Android 110+                                             |
| ENF-8 | Audit         | Export                     | CSV + PDF dispo en < 30s pour 1 mois 10 boutiques                                |
