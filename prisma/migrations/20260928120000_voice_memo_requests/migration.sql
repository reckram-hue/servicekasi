-- AlterEnum
ALTER TYPE "RequestSource" ADD VALUE 'VOICE_MEMO';

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "transcript" TEXT;

