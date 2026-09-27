-- CreateEnum
CREATE TYPE "Industry" AS ENUM ('PLUMBING', 'ELECTRICAL', 'LANDSCAPING', 'POOL', 'GENERAL_MAINTENANCE', 'OTHER');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "industry" "Industry";
