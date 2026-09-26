-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "creditedCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "LineItem" ADD COLUMN     "creditsLineItemId" TEXT;

-- CreateIndex
CREATE INDEX "LineItem_creditsLineItemId_idx" ON "LineItem"("creditsLineItemId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_creditsInvoiceId_fkey" FOREIGN KEY ("creditsInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
