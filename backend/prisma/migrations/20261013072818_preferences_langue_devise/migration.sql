-- AlterTable
ALTER TABLE "calculs" ADD COLUMN     "devise" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "principalUnite" TEXT,
ADD COLUMN     "principalValeur" TEXT;

-- AlterTable
ALTER TABLE "utilisateurs" ADD COLUMN     "devise" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "langue" TEXT NOT NULL DEFAULT 'fr';
