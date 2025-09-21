/*
  Warnings:
  - A unique constraint covering the columns `[slug]` on the table `Experience` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `Experience` table without a default value. This is not possible if the table is not empty.
*/

-- 1. Add the `slug` column as nullable first
ALTER TABLE "Experience" ADD COLUMN "slug" TEXT;

-- 2. Update the existing rows to populate `slug` based on `name`
UPDATE "Experience"
SET "slug" = LOWER(REPLACE("name", ' ', '-'));

-- 3. Add a unique constraint to ensure slugs are unique
CREATE UNIQUE INDEX "Experience_slug_key" ON "Experience"("slug");

-- 4. Alter the `slug` column to set it as NOT NULL
ALTER TABLE "Experience" ALTER COLUMN "slug" SET NOT NULL;
