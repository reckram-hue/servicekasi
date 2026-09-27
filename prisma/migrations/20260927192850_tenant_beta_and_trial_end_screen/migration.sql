-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "isBeta" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trialEndScreenShownAt" TIMESTAMP(3);
