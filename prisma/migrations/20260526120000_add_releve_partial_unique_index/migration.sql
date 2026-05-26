-- US-REL-002 - Unicite du releve ACTIF (RG-CREN-001 / EX-REL-005).
--
-- Un seul releve ACTIF est autorise par (equipementId, date, creneau).
-- Les releves annules (annuleParId IS NOT NULL) sont exclus du
-- constraint : plusieurs annules peuvent coexister (historique des
-- corrections) et un nouveau releve peut etre cree apres annulation
-- (decision technique #3 - double saisie post-annulation autorisee).
--
-- Prisma 6 ne supporte pas les partial unique indexes en schema natif,
-- d'ou cette migration SQL manuelle.
CREATE UNIQUE INDEX IF NOT EXISTS releve_actif_unique
  ON "Releve" ("equipementId", "date", "creneau")
  WHERE "annuleParId" IS NULL;
