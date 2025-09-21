/*
  Warnings:

  - You are about to drop the column `date` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `experienceId` on the `Booking` table. All the data in the column will be lost.
  - Added the required column `scheduleSlotId` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Booking` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_experienceId_fkey";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "date",
DROP COLUMN "experienceId",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "scheduleSlotId" INTEGER NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'confirmed',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ScheduleSlot" ADD COLUMN     "isCancelled" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_scheduleSlotId_fkey" FOREIGN KEY ("scheduleSlotId") REFERENCES "ScheduleSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
