-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "marketingOptOutAt" TIMESTAMP(3),
ADD COLUMN     "marketingOptOutSource" TEXT,
ADD COLUMN     "unsubscribeToken" TEXT;

-- Backfill existing rows with a unique token (new rows get one from the Prisma-level default)
UPDATE "Client" SET "unsubscribeToken" = gen_random_uuid()::text WHERE "unsubscribeToken" IS NULL;

ALTER TABLE "Client" ALTER COLUMN "unsubscribeToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Client_unsubscribeToken_key" ON "Client"("unsubscribeToken");
