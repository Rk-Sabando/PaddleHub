-- Players can now request to join any time before an event ends, so the
-- MATCHMAKING phase no longer means anything distinct. Fold any existing
-- MATCHMAKING rows back into OPEN, then swap the enum.

BEGIN;

UPDATE "Event" SET "status" = 'OPEN' WHERE "status" = 'MATCHMAKING';

CREATE TYPE "EventStatus_new" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

ALTER TABLE "Event" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Event" ALTER COLUMN "status" TYPE "EventStatus_new" USING ("status"::text::"EventStatus_new");

ALTER TYPE "EventStatus" RENAME TO "EventStatus_old";
ALTER TYPE "EventStatus_new" RENAME TO "EventStatus";
DROP TYPE "EventStatus_old";

ALTER TABLE "Event" ALTER COLUMN "status" SET DEFAULT 'OPEN';

COMMIT;
