/*
  Warnings:

  - Added the required column `courtId` to the `Match` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLAYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "CourtStatus" AS ENUM ('AVAILABLE', 'MAINTENANCE', 'CLOSED');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "courtId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'PLAYER';

-- CreateTable
CREATE TABLE "Court" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "status" "CourtStatus" NOT NULL DEFAULT 'AVAILABLE',
    "managerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Court_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Court_name_key" ON "Court"("name");

-- CreateIndex
CREATE INDEX "Court_status_idx" ON "Court"("status");

-- CreateIndex
CREATE INDEX "Match_courtId_scheduledAt_idx" ON "Match"("courtId", "scheduledAt");

-- AddForeignKey
ALTER TABLE "Court" ADD CONSTRAINT "Court_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
