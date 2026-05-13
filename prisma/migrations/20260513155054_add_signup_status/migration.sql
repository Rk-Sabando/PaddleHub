-- CreateEnum
CREATE TYPE "SignupStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

-- AlterTable
ALTER TABLE "EventSignup" ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decidedById" TEXT,
ADD COLUMN     "status" "SignupStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "EventSignup_eventId_status_idx" ON "EventSignup"("eventId", "status");
