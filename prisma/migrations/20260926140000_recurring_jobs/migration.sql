-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "recurrenceEndTime" TEXT,
ADD COLUMN     "recurrenceGeneratedUntil" TEXT,
ADD COLUMN     "recurrenceInstructions" TEXT,
ADD COLUMN     "recurrenceStart" TEXT,
ADD COLUMN     "recurrenceStartTime" TEXT,
ADD COLUMN     "recurrenceTechnicianIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "occurrenceDate" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Visit_jobId_occurrenceDate_key" ON "Visit"("jobId", "occurrenceDate");

