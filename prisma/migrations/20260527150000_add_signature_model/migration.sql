-- Epic SIGNATURE (US-SIG-001) : ajout du modele Signature et des enums audit.
--
-- Stockage Vercel Blob ; la colonne `storageKey` porte le pathname
-- canonique (`signatures/<boutiqueId>/<dateISO>/<timestamp>-<uuid>.png`).
-- L'URL Vercel Blob publique non-listable est persistee dans `blobUrl`
-- (decouplage lecture / variables d'environnement).
--
-- Tracabilite immuable HACCP : la table n'accepte ni UPDATE metier
-- ni DELETE. Le `RESTRICT` sur `boutiqueId` et `signataireId` empeche
-- la suppression "fantome" d'un signataire audite ou d'une boutique
-- referencee par une signature.
--
-- Note PostgreSQL : `ALTER TYPE ... ADD VALUE` est non-transactionnel
-- et ne peut pas etre rollback. Si la migration echoue apres l'ALTER,
-- le type contient deja la valeur (sans dommage : compatibilite
-- ascendante de l'enum, les anciennes lignes restent valides).

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SIGNATURE_CREATE';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'SIGNATURE';

CREATE TABLE "Signature" (
    "id" TEXT NOT NULL,
    "boutiqueId" TEXT NOT NULL,
    "dateISO" TEXT NOT NULL,
    "signataireId" TEXT NOT NULL,
    "signataireRoleSnapshot" "UserRole" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Signature_storageKey_key" ON "Signature"("storageKey");
CREATE UNIQUE INDEX "Signature_boutiqueId_dateISO_key" ON "Signature"("boutiqueId", "dateISO");
CREATE INDEX "Signature_signataireId_idx" ON "Signature"("signataireId");

ALTER TABLE "Signature" ADD CONSTRAINT "Signature_boutiqueId_fkey"
  FOREIGN KEY ("boutiqueId") REFERENCES "Boutique"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Signature" ADD CONSTRAINT "Signature_signataireId_fkey"
  FOREIGN KEY ("signataireId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
