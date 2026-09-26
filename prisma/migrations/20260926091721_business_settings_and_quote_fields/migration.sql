-- AlterTable
ALTER TABLE "LineItem" ADD COLUMN     "selected" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "approvedIp" TEXT,
ADD COLUMN     "clientMessage" TEXT,
ADD COLUMN     "depositPercent" INTEGER;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "defaultQuoteValidDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "quoteTerms" TEXT;
