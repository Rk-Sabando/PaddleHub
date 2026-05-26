/*
  Warnings:

  - Made the column `matchmakingDisabled` on table `Event` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_courtId_fkey";

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "matchmakingDisabled" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE SET NULL ON UPDATE CASCADE;
