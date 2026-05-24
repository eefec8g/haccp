# Backlog Produit - Maison Givre HACCP

**Methode** : MoSCoW priorisation, format INVEST, criteres d'acceptation Given/When/Then.

---

## Release v1.0 - MVP utilisable (objectif : ~2-3 semaines de dev)

### Epic AUTH - Authentification

#### US-AUTH-001 - Connexion email/mot de passe

**Priorite** : Must
**Story Points** : 3
**En tant que** utilisateur, **je veux** me connecter avec mon email et mon mot de passe, **afin de** acceder a l'app.

**Criteres d'acceptation** :

```gherkin
Scenario: Connexion valide
  Given un utilisateur actif avec email "lea@maison-givre.fr" et password "Secret123!"
  When il poste /api/auth/login avec ces identifiants
  Then la session est cree
  And il est redirige vers /releves (Salarie) ou /dashboard (Responsable/Admin)

Scenario: Mot de passe incorrect
  Given un utilisateur "lea@maison-givre.fr"
  When il saisit un mauvais mot de passe
  Then HTTP 401 avec message generique (pas d'enumeration)
  And tentative comptee pour le rate limit

Scenario: Rate limit
  Given 5 tentatives echouees en 15 min depuis la meme IP
  When une 6eme tentative
  Then HTTP 429 avec retry-after header
```

#### US-AUTH-002 - Mot de passe oublie

**Priorite** : Must
**Story Points** : 3
**En tant qu'** utilisateur, **je veux** reinitialiser mon mot de passe par email, **afin de** retrouver l'acces.

#### US-AUTH-003 - Logout

**Priorite** : Must
**Story Points** : 1
**En tant qu'** utilisateur, **je veux** me deconnecter, **afin de** proteger mon compte (BYOD).

---

### Epic ADMIN - Gestion parc

#### US-ADM-001 - Admin cree une boutique

**Priorite** : Must
**Story Points** : 3
**En tant qu'** Admin, **je veux** creer une boutique (nom, adresse, ville), **afin de** initialiser le parc.

#### US-ADM-002 - Admin cree un equipement

**Priorite** : Must
**Story Points** : 5
**En tant qu'** Admin, **je veux** ajouter un equipement a une boutique (nom, type, seuils min/max), **afin de** qu'il apparaisse dans les tournees des salaries de la boutique.

```gherkin
Scenario: Ajout congelateur
  Given je suis Admin
  And la boutique "MG Paris 11" existe
  When je cree un equipement "CGL-01" type CONGELATEUR sans seuils specifies
  Then les seuils par defaut [-25, -18] sont appliques
  And l'equipement est visible dans la tournee des salaries de MG Paris 11
```

#### US-ADM-003 - Admin cree un utilisateur

**Priorite** : Must
**Story Points** : 5
**En tant qu'** Admin, **je veux** creer un compte salarie/responsable et le rattacher a 1 ou plusieurs boutiques, **afin de** donner acces a l'app.

- Inclut envoi email d'invitation avec lien de premiere connexion.

#### US-ADM-004 - Admin desactive un equipement/boutique/utilisateur

**Priorite** : Should
**Story Points** : 2
**En tant qu'** Admin, **je veux** desactiver une entite plutot que la supprimer, **afin de** preserver l'historique pour audit.

---

### Epic RELEVE - Saisie quotidienne (coeur metier)

#### US-REL-001 - Salarie voit sa tournee du jour

**Priorite** : Must
**Story Points** : 5
**En tant que** Salarie, **je veux** voir la liste des equipements de ma boutique avec les 3 creneaux (matin/midi/soir) et leur statut, **afin de** savoir ce qui reste a faire.

```gherkin
Scenario: Vue tournee
  Given je suis Salarie de "MG Paris 11" (3 equipements)
  And il est 14h
  And j'ai saisi le creneau MATIN pour les 3 equipements
  When j'ouvre /releves
  Then je vois 3 cartes equipement
  And chaque carte affiche MATIN=fait MIDI=a faire SOIR=a faire
  And le creneau MIDI est mis en avant (creneau courant)
```

#### US-REL-002 - Salarie saisit un releve

**Priorite** : Must
**Story Points** : 8 (US la plus critique)
**En tant que** Salarie, **je veux** saisir la temperature d'un equipement pour un creneau, **afin de** respecter la norme HACCP.

```gherkin
Scenario: Releve dans les seuils
  Given equipement CGL-01 seuils [-25, -18]
  When je saisis temperature=-20 pour CGL-01 / MATIN
  Then le releve est cree
  And la signature numerique est calculee serveur
  And le tableau de tournee se met a jour (MATIN passe a FAIT)
  And je vois un toast "Releve enregistre"
  And c'est plus rapide que 10 secondes

Scenario: Releve hors seuils sans commentaire
  When je saisis temperature=-10 pour CGL-01 / MIDI sans commentaire
  Then le formulaire affiche "Commentaire obligatoire en cas d'alerte"
  And le bouton "Valider" reste actif uniquement apres saisie >= 10 caracteres

Scenario: Releve hors seuils avec commentaire
  When je saisis temperature=-10 / MIDI / commentaire "Porte restee ouverte pendant la livraison, refermee"
  Then le releve est cree (alerteHorsSeuils=true)
  And une Alerte est creee status=OUVERTE
  And les Responsables de la boutique recoivent un email dans la minute
  And le tableau affiche un badge ALERTE sur le creneau MIDI

Scenario: Tentative double saisie
  Given j'ai deja saisi MATIN pour CGL-01 aujourd'hui
  When je tente de saisir un nouveau releve MATIN pour CGL-01
  Then HTTP 409 Conflict
  And message "Un releve existe deja pour ce creneau. Utilisez la correction."
```

#### US-REL-003 - Salarie consulte ses releves recents

**Priorite** : Should
**Story Points** : 3
**En tant que** Salarie, **je veux** voir mes 7 derniers jours de releves, **afin de** verifier mon historique recent.

#### US-REL-004 - Responsable corrige un releve errone

**Priorite** : Must
**Story Points** : 5
**En tant que** Responsable, **je veux** annuler un releve errone avec un motif et eventuellement le remplacer, **afin de** maintenir la tracabilite sans perdre la preuve audit.

```gherkin
Scenario: Annulation simple
  Given un releve actif R1 (CGL-01 / MATIN / -20)
  When le Responsable cree un releve "annulation" avec motif="erreur de saisie, vraie valeur -22"
  Then R1 est marque annule (annule_par_id pointe vers le nouveau releve)
  And le nouveau releve devient actif
  And l'historique conserve R1 en lecture seule
```

---

### Epic ALERTE - Gestion alertes

#### US-ALE-001 - Responsable voit ses alertes ouvertes

**Priorite** : Must
**Story Points** : 3
**En tant que** Responsable, **je veux** voir la liste des alertes non resolues de mes boutiques, **afin de** prioriser mes actions.

#### US-ALE-002 - Responsable resout une alerte

**Priorite** : Must
**Story Points** : 3
**En tant que** Responsable, **je veux** marquer une alerte RESOLUE avec un commentaire (cause + action corrective), **afin de** documenter ma reaction pour l'audit.

#### US-ALE-003 - Notification email sur alerte

**Priorite** : Must
**Story Points** : 5
**En tant que** Responsable, **je veux** recevoir un email immediat des qu'une alerte est creee sur une de mes boutiques, **afin de** reagir en moins d'une heure.

```gherkin
Scenario: Mail alerte
  Given je suis Responsable de "MG Paris 11" et "MG Lyon"
  When un Salarie de MG Paris 11 saisit un releve hors seuils
  Then je recois un email dans la minute
  And le mail contient : boutique, equipement, creneau, temperature, seuils, commentaire, lien direct vers l'alerte
  And le Responsable de MG Lyon ne recoit RIEN
```

---

### Epic DASHBOARD

#### US-DAS-001 - Dashboard Responsable

**Priorite** : Must
**Story Points** : 5
**En tant que** Responsable, **je veux** un tableau de bord avec mes alertes ouvertes, completude du jour par boutique, et liens vers exports, **afin de** piloter rapidement.

#### US-DAS-002 - Dashboard Admin

**Priorite** : Should
**Story Points** : 5
**En tant qu'** Admin, **je veux** vue parc complet : KPIs globaux, alertes 7j, taux completude global.

---

### Epic EXPORT

#### US-EXP-001 - Export CSV

**Priorite** : Must
**Story Points** : 5
**En tant que** Responsable, **je veux** exporter les releves d'une periode/boutique/equipement en CSV, **afin de** analyser ou archiver.

#### US-EXP-002 - Export PDF registre journalier

**Priorite** : Must
**Story Points** : 8 (gros)
**En tant que** Responsable, **je veux** generer un PDF journalier presentable a la DDPP (entete boutique, liste releves, alertes, signatures), **afin de** passer un controle sanitaire en 1 clic.

---

## Release v1.1 - Conformite legale renforcee

### Epic PHOTOS

#### US-PHO-001 - Photo justificative sur alerte

**Priorite** : Must (v1.1)
**Story Points** : 8
**En tant que** Salarie, **je veux** prendre une photo lors d'une alerte (vue thermometre, ecran congelateur), **afin de** documenter la preuve.

- Stockage : Vercel Blob ou S3
- Compression cote client (< 500 Ko / photo)

### Epic SIGNATURE MANUSCRITE

#### US-SIG-001 - Signature canvas du registre journalier

**Priorite** : Should (v1.1, si exigence DDPP confirmee)
**Story Points** : 5
**En tant que** Responsable, **je veux** signer le registre journalier de chaque boutique en fin de journee (canvas), **afin de** verrouiller l'audit.

### Epic REGISTRE

#### US-REG-001 - Registre journalier consolide

**Priorite** : Must (v1.1)
**Story Points** : 5
**En tant que** Responsable, **je veux** une vue "registre journalier" par boutique x date qui resume tous les releves + alertes + commentaires, **afin de** valider la journee.

---

## Release v2.0 - Optimisation operationnelle

- US-STAT-001 - Stats tendances : evolution temperature moyenne par equipement sur 30j
- US-NOT-001 - Notification SMS optionnelle (Twilio)
- US-API-001 - API publique pour integrations (ERP, caisse)
- US-PRED-001 - Detection derives lentes (temperature en hausse progressive avant alerte)
- US-MUL-001 - Multi-langue si expansion internationale

---

## Definition of Ready (DoR)

- [ ] Format INVEST respecte
- [ ] Criteres d'acceptation Given/When/Then ecrits
- [ ] Priorite MoSCoW + Story Points
- [ ] Maquettes UI si UI (a faire pour les US Must de v1.0)
- [ ] Dependances identifiees

## Definition of Done (DoD)

- [ ] Code developpe + PR review
- [ ] Tests unitaires (coverage > 80%) + Tests E2E pour les CA principaux
- [ ] 0 erreur TS / ESLint, build CI passe
- [ ] Deploye + teste sur staging
- [ ] CA valides par le PO (Erkan)
