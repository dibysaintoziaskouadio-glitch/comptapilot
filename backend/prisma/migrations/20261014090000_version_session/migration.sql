-- Révocation des sessions : une session porte la version en vigueur à sa création.
ALTER TABLE "utilisateurs" ADD COLUMN "versionSession" INTEGER NOT NULL DEFAULT 0;
