-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "buyerSnapshot" JSONB,
ADD COLUMN     "notes" TEXT,
ALTER COLUMN "number" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "defaultPaymentTermsDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "invoiceTerms" TEXT;
