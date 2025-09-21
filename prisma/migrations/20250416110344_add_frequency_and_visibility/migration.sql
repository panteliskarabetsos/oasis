-- AlterTable
ALTER TABLE "Experience" ADD COLUMN     "frequency" TEXT,
ADD COLUMN     "visibility" BOOLEAN NOT NULL DEFAULT true;
