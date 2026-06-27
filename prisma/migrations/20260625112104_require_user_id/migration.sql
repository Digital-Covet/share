-- Make userId required (NOT NULL) on files table
-- First, backfill any existing NULL userIds with a placeholder
-- (anonymous uploads are not permitted for this internal tool)
UPDATE "files" SET "userId" = 'orphan' WHERE "userId" IS NULL;

-- Then alter the column to be NOT NULL
ALTER TABLE "files" ALTER COLUMN "userId" SET NOT NULL;
