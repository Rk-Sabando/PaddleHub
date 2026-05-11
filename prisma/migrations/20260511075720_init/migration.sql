-- CreateEnum
CREATE TYPE "MatchFormat" AS ENUM ('SINGLES', 'DOUBLES');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('OPEN', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PRO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "skillRating" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "skillLevel" "SkillLevel" NOT NULL DEFAULT 'INTERMEDIATE',
    "preferredFormat" "MatchFormat" NOT NULL DEFAULT 'DOUBLES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "format" "MatchFormat" NOT NULL,
    "skillMin" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "skillMax" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "capacity" INTEGER NOT NULL,
    "notes" TEXT,
    "status" "MatchStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchParticipant" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "waitlist" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MatchParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "sportsmanship" INTEGER NOT NULL,
    "punctuality" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_skillRating_idx" ON "User"("skillRating");

-- CreateIndex
CREATE INDEX "Match_status_scheduledAt_idx" ON "Match"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatchParticipant_matchId_userId_key" ON "MatchParticipant"("matchId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_matchId_fromId_toId_key" ON "Rating"("matchId", "fromId", "toId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
