-- US-ADM-003 - Persistance du `name` saisi a l'invitation
-- Le formulaire d'invitation collecte un champ "name" (USER_NOM) mais il
-- n'etait pas persiste : le User cree a l'acceptation se retrouvait avec
-- `name = email`. On ajoute le champ sur UserInvitation pour pouvoir le
-- propager a la creation du User dans `acceptInvitation`.
--
-- Nullable pour rester compatible avec les invitations creees avant cette
-- migration. Le service traite NULL en fallback vers `email` (cf.
-- buildAcceptUserData) pour rester compatible avec les anciens tokens
-- encore valides (TTL 24h).

ALTER TABLE "UserInvitation" ADD COLUMN "name" TEXT;
