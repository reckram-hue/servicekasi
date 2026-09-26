-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "reference" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3);
