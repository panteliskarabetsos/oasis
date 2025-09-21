/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Experience` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Experience_name_key" ON "Experience"("name");
