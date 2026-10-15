-- Administration des comptes : désactivation et suivi de la dernière activité.
ALTER TABLE "utilisateurs" ADD COLUMN "actif" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "utilisateurs" ADD COLUMN "derniereActivite" TIMESTAMP(3);
