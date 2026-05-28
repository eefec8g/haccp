-- Epic RELEVE - dates de debut d'activite.
--
-- Ajoute :
--   - Boutique.dateOuverture     : date d'ouverture de la boutique.
--   - Equipement.dateMiseEnService : date de mise en service de l'equipement.
--
-- Objectif metier : ne plus compter de releves "manquants" AVANT la date
-- de debut effective d'un equipement (MAX(boutique.dateOuverture,
-- equipement.dateMiseEnService)). Les colonnes sont typees `DATE` (jour
-- sans heure, aligne sur Releve.date) et NOT NULL (la saisie applicative
-- est obligatoire via Zod cote admin).
--
-- Strategie pour les lignes existantes : DEFAULT CURRENT_DATE transitoire
-- pour rendre la migration non-bloquante, puis suppression du DEFAULT pour
-- forcer toute nouvelle ecriture a fournir explicitement la valeur (NOT
-- NULL strict cote applicatif). La DB de test est de toute facon resettee.

ALTER TABLE "Boutique" ADD COLUMN "dateOuverture" DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE "Boutique" ALTER COLUMN "dateOuverture" DROP DEFAULT;

ALTER TABLE "Equipement" ADD COLUMN "dateMiseEnService" DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE "Equipement" ALTER COLUMN "dateMiseEnService" DROP DEFAULT;
