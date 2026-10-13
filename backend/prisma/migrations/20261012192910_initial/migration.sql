-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'COMPTABLE', 'LECTEUR');

-- CreateEnum
CREATE TYPE "StatutCalcul" AS ENUM ('BROUILLON', 'VALIDE');

-- CreateEnum
CREATE TYPE "StatutBareme" AS ENUM ('OFFICIEL', 'A_VERIFIER');

-- CreateEnum
CREATE TYPE "OrigineBareme" AS ENUM ('BIBLIOTHEQUE', 'SAISIE');

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "motDePasse" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'COMPTABLE',
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "derniereConnexion" TIMESTAMP(3),

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculs" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "moteur" TEXT NOT NULL,
    "formuleId" TEXT NOT NULL,
    "formuleNom" TEXT NOT NULL,
    "formuleVersion" TEXT NOT NULL,
    "libelle" TEXT,
    "entrees" JSONB NOT NULL,
    "resultat" JSONB NOT NULL,
    "principal" TEXT,
    "empreinte" TEXT NOT NULL,
    "nbErreurs" INTEGER NOT NULL DEFAULT 0,
    "nbAvertissements" INTEGER NOT NULL DEFAULT 0,
    "dureeMs" DOUBLE PRECISION NOT NULL,
    "statut" "StatutCalcul" NOT NULL DEFAULT 'BROUILLON',
    "valideLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calculs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versions_baremes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "moteur" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "du" TEXT NOT NULL,
    "au" TEXT,
    "valeurs" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "statut" "StatutBareme" NOT NULL,
    "origine" "OrigineBareme" NOT NULL DEFAULT 'BIBLIOTHEQUE',
    "auteurId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "versions_baremes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_audit" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT,
    "action" TEXT NOT NULL,
    "cible" TEXT,
    "details" JSONB,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE INDEX "calculs_utilisateurId_creeLe_idx" ON "calculs"("utilisateurId", "creeLe");

-- CreateIndex
CREATE INDEX "calculs_moteur_formuleId_idx" ON "calculs"("moteur", "formuleId");

-- CreateIndex
CREATE INDEX "calculs_empreinte_idx" ON "calculs"("empreinte");

-- CreateIndex
CREATE INDEX "versions_baremes_code_idx" ON "versions_baremes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "versions_baremes_code_du_key" ON "versions_baremes"("code", "du");

-- CreateIndex
CREATE INDEX "journal_audit_creeLe_idx" ON "journal_audit"("creeLe");

-- AddForeignKey
ALTER TABLE "calculs" ADD CONSTRAINT "calculs_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versions_baremes" ADD CONSTRAINT "versions_baremes_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
