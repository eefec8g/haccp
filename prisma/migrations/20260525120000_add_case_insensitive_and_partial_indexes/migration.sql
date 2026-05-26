-- Index fonctionnels case-insensitive sur les noms d'entites
-- Utilises par la verification d'unicite case-insensitive dans
-- boutique.service.ts (findFirst mode: 'insensitive') et
-- equipement.service.ts. Sans ces index, PostgreSQL fait un seq scan
-- sur la table entiere a chaque check d'unicite (degradation lineaire
-- au-dela de ~1000 lignes).
--
-- Filtre `WHERE "actif" = true` pour ne couvrir que les entites actives
-- (les soft-deleted n'entrent pas dans la contrainte d'unicite).
CREATE INDEX IF NOT EXISTS boutique_nom_lower_idx
  ON "Boutique" (LOWER("nom"))
  WHERE "actif" = true;

CREATE INDEX IF NOT EXISTS equipement_nom_boutique_lower_idx
  ON "Equipement" (LOWER("nom"), "boutiqueId")
  WHERE "actif" = true;

-- Index partiels `WHERE "usedAt" IS NULL` pour les tokens non-utilises.
-- Optimise validateInvitationToken (UserInvitation) et validateResetToken
-- (PasswordResetToken) qui ne s'interessent qu'aux tokens encore actifs.
-- Sur le long terme, les tables grossissent (audit conservation) mais
-- l'index reste petit (seuls les tokens pending y figurent).
CREATE INDEX IF NOT EXISTS user_invitation_pending_idx
  ON "UserInvitation" ("email")
  WHERE "usedAt" IS NULL;

CREATE INDEX IF NOT EXISTS password_reset_token_pending_idx
  ON "PasswordResetToken" ("token")
  WHERE "usedAt" IS NULL;
