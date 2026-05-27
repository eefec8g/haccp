-- Epic PHOTOS (US-PHO-001) : ajout du modele Photo et des enums audit.
--
-- Stockage Vercel Blob ; la colonne `storageKey` porte le pathname
-- canonique (`photos/<alerteId>/<timestamp>-<uuid>.<ext>`). L'URL
-- signee n'est PAS persistee (regenerable a la volee, TTL configurable).
--
-- Cascade delete sur Alerte volontaire pour eviter des Photo orphelines
-- en cas de suppression theorique d'alerte (jamais en pratique HACCP).
-- FK `uploadedByUserId` -> User en RESTRICT pour empecher la suppression
-- d'un acteur audite (symetrique avec `AuditLog.performedById`).
--
-- Note PostgreSQL : `ALTER TYPE ... ADD VALUE` est non-transactionnel
-- et ne peut pas etre rollback. Si la migration echoue apres l'ALTER,
-- le type contient deja la valeur (sans dommage : compatibilite
-- ascendante de l'enum, les anciennes lignes restent valides).

ALTER TYPE "AuditAction" ADD VALUE 'PHOTO_UPLOAD';
ALTER TYPE "AuditAction" ADD VALUE 'PHOTO_DELETE';
ALTER TYPE "AuditEntityType" ADD VALUE 'PHOTO';

CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "alerteId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Photo_storageKey_key" ON "Photo"("storageKey");
CREATE INDEX "Photo_alerteId_idx" ON "Photo"("alerteId");
CREATE INDEX "Photo_uploadedByUserId_idx" ON "Photo"("uploadedByUserId");

ALTER TABLE "Photo" ADD CONSTRAINT "Photo_alerteId_fkey"
  FOREIGN KEY ("alerteId") REFERENCES "Alerte"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Photo" ADD CONSTRAINT "Photo_uploadedByUserId_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
