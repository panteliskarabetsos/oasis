-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "numberOfPeople" INTEGER NOT NULL DEFAULT 1;
