-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'ON_HOLD';

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "onHoldReason" TEXT;
