-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_scheduleSlotId_fkey";

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_scheduleSlotId_fkey" FOREIGN KEY ("scheduleSlotId") REFERENCES "ScheduleSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
