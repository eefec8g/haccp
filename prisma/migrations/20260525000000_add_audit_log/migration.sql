-- US-ADM-004 - Journal d'audit
-- Ajoute la table AuditLog + enums associes pour tracer les actions
-- admin sensibles (CREATE/DISABLE/ENABLE/UPDATE/DELETE) avec motif.
-- Tracabilite HACCP : la table n'est jamais modifiee/supprimee apres
-- ecriture. La cle etrangere `performedById` est ON DELETE RESTRICT
-- pour empecher la suppression "fantome" d'un acteur audite.

-- =========================================
-- CreateEnum
-- =========================================
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DISABLE', 'ENABLE', 'DELETE');

CREATE TYPE "AuditEntityType" AS ENUM ('BOUTIQUE', 'EQUIPEMENT', 'USER', 'INVITATION');

-- =========================================
-- CreateTable: AuditLog
-- =========================================
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityLabel" TEXT,
    "motif" TEXT,
    "metadata" JSONB,
    "performedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- =========================================
-- Indexes
-- =========================================
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_performedById_idx" ON "AuditLog"("performedById");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- =========================================
-- Foreign keys
-- =========================================
ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_performedById_fkey"
    FOREIGN KEY ("performedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
