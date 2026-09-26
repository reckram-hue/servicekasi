-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "isDeposit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quoteId" TEXT;

-- AlterTable
ALTER TABLE "LineItem" ADD COLUMN     "deductsInvoiceId" TEXT;

-- CreateIndex
CREATE INDEX "Invoice_jobId_idx" ON "Invoice"("jobId");

-- CreateIndex
CREATE INDEX "Invoice_quoteId_idx" ON "Invoice"("quoteId");

-- CreateIndex
CREATE INDEX "LineItem_deductsInvoiceId_idx" ON "LineItem"("deductsInvoiceId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
