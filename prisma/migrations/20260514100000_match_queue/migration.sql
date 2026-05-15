-- Pre-formed match queue: queued matches sit with courtId=null until a court
-- frees up. Also add startedAt so the timer reflects "when this match went
-- live" instead of "when this Match row was created."

BEGIN;

-- 1. Allow queued matches (no court yet).
ALTER TABLE "Match" ALTER COLUMN "courtId" DROP NOT NULL;

-- 2. New timer source.
ALTER TABLE "Match" ADD COLUMN "startedAt" TIMESTAMP(3);

-- 3. Backfill: any currently-running match keeps its visible timer by treating
--    createdAt as the start instant.
UPDATE "Match"
SET "startedAt" = "createdAt"
WHERE "status" = 'CONFIRMED' AND "startedAt" IS NULL;

COMMIT;
