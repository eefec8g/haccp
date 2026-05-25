-- Epic ADMIN - socle commun
-- Cree la table UserInvitation et confirme les flags actif sur les entites principales.
-- Les flags actif existent deja dans schema.prisma (Boutique, Equipement, User) :
-- cette migration ne fait que matcher l'etat declaratif Prisma et ajouter
-- la table UserInvitation + ses indexes.

-- =========================================
-- CreateTable: UserInvitation
-- =========================================
CREATE TABLE "UserInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedById" TEXT NOT NULL,
    "boutiqueSalarieId" TEXT,
    "boutiquesResponsable" TEXT[],

    CONSTRAINT "UserInvitation_pkey" PRIMARY KEY ("id")
);

-- =========================================
-- Indexes
-- =========================================
CREATE UNIQUE INDEX "UserInvitation_token_key" ON "UserInvitation"("token");
CREATE INDEX "UserInvitation_email_idx" ON "UserInvitation"("email");
CREATE INDEX "UserInvitation_token_idx" ON "UserInvitation"("token");
CREATE INDEX "UserInvitation_expiresAt_idx" ON "UserInvitation"("expiresAt");
CREATE INDEX "UserInvitation_invitedById_idx" ON "UserInvitation"("invitedById");

-- =========================================
-- Foreign keys
-- =========================================
ALTER TABLE "UserInvitation"
    ADD CONSTRAINT "UserInvitation_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
