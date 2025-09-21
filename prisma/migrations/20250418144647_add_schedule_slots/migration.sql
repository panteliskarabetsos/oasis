-- CreateTable
CREATE TABLE "ScheduleSlot" (
    "id" SERIAL NOT NULL,
    "experienceId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalSlots" INTEGER NOT NULL,
    "bookedSlots" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleSlot_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
