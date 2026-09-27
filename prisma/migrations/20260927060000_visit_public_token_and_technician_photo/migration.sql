-- AlterTable
ALTER TABLE "User" ADD COLUMN "photoUrl" TEXT;

-- AlterTable: publicToken is backfilled for existing rows before being made required
ALTER TABLE "Visit" ADD COLUMN "publicToken" TEXT;
UPDATE "Visit" SET "publicToken" = gen_random_uuid()::text WHERE "publicToken" IS NULL;
ALTER TABLE "Visit" ALTER COLUMN "publicToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Visit_publicToken_key" ON "Visit"("publicToken");
