-- CreateEnum
CREATE TYPE "ObjetCode" AS ENUM ('VERIFICATION_EMAIL', 'VERIFICATION_TELEPHONE', 'REINITIALISATION');

-- CreateEnum
CREATE TYPE "CanalCode" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP');

-- AlterTable
ALTER TABLE "utilisateurs" ADD COLUMN     "emailVerifieLe" TIMESTAMP(3),
ADD COLUMN     "telephone" TEXT,
ADD COLUMN     "telephoneVerifieLe" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "codes_verification" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "objet" "ObjetCode" NOT NULL,
    "canal" "CanalCode" NOT NULL,
    "destination" TEXT NOT NULL,
    "empreinte" TEXT NOT NULL,
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "utiliseLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codes_verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "codes_verification_utilisateurId_objet_creeLe_idx" ON "codes_verification"("utilisateurId", "objet", "creeLe");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_telephone_key" ON "utilisateurs"("telephone");

-- AddForeignKey
ALTER TABLE "codes_verification" ADD CONSTRAINT "codes_verification_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Les comptes créés avant la vérification par code sont considérés comme confirmés.
UPDATE "utilisateurs" SET "emailVerifieLe" = "creeLe" WHERE "emailVerifieLe" IS NULL;
