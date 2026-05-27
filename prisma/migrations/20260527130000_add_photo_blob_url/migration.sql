-- Epic PHOTOS (US-PHO-001 - finding C-1) : persistance de l'URL publique
-- Vercel Blob retournee par `put()` au moment de l'upload.
--
-- Avant : l'URL etait reconstruite a chaque lecture via la variable
-- d'environnement `VERCEL_BLOB_PUBLIC_BASE_URL` (fallback `/blob/<key>`
-- cassant en prod si l'env etait manquante).
-- Apres : l'URL est persistee directement dans la table Photo, decouplant
-- la lecture de toute configuration runtime.
--
-- La colonne est ajoutee avec un DEFAULT '' transitoire pour rendre la
-- migration non-bloquante sur les eventuelles lignes existantes (env de
-- pre-prod), puis le DEFAULT est supprime pour forcer toutes les nouvelles
-- ecritures a fournir explicitement la valeur (NOT NULL strict).

ALTER TABLE "Photo" ADD COLUMN "blobUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Photo" ALTER COLUMN "blobUrl" DROP DEFAULT;
