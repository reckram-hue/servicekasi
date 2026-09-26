import 'server-only';
import type { Prisma, PaymentMethod } from '@prisma/client';
import { syncJobInvoicingStatus } from '@/lib/jobs/status';

/** Sum of this invoice's active (non-reversed, successful) payments decides its status. */
function statusFromBalance(totalCents: number, paidCents: number): 'SENT' | 'PARTIALLY_PAID' | 'PAID' {
  if (paidCents >= totalCents) return 'PAID';
  return paidCents > 0 ? 'PARTIALLY_PAID' : 'SENT';
}

/** Recomputes paidCents/status from scratch from this invoice's active payments. Caller must already hold the invoice row lock. */
async function recalcInvoice(tx: Prisma.TransactionClient, invoiceId: string, totalCents: number): Promise<void> {
  const agg = await tx.payment.aggregate({
    where: { invoiceId, status: 'SUCCEEDED', reversedAt: null },
    _sum: { amountCents: true },
  });
  const paidCents = agg._sum.amountCents ?? 0;
  await tx.invoice.update({ where: { id: invoiceId }, data: { paidCents, status: statusFromBalance(totalCents, paidCents) } });
}

/**
 * Records a payment an owner took by hand (cash, EFT, card machine…) against
 * an issued invoice. Locks the invoice row first, so two payments recorded at
 * the same moment can't both read a stale balance and together overpay it.
 */
export async function recordPayment(
  tx: Prisma.TransactionClient,
  args: { tenantId: string; invoiceId: string; amountCents: number; method: PaymentMethod; receivedAt: Date; reference: string | null; userId: string }
): Promise<{ error: string } | { ok: true }> {
  const { tenantId, invoiceId, amountCents, method, receivedAt, reference, userId } = args;

  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  if (locked.length === 0) return { error: 'Invoice not found.' };

  const invoice = await tx.invoice.findFirstOrThrow({
    where: { id: invoiceId, tenantId },
    select: { status: true, totalCents: true, paidCents: true, jobId: true },
  });
  if (invoice.status === 'DRAFT') return { error: 'This invoice has not been issued yet.' };
  if (invoice.status === 'VOID') return { error: 'This invoice has been voided.' };

  const balanceCents = invoice.totalCents - invoice.paidCents;
  if (balanceCents <= 0) return { error: 'This invoice is already fully paid.' };
  if (amountCents > balanceCents) return { error: "That's more than the balance due. Reload the page to see the current balance." };

  await tx.payment.create({
    data: { tenantId, invoiceId, method, status: 'SUCCEEDED', amountCents, receivedAt, reference: reference || undefined },
  });

  await recalcInvoice(tx, invoiceId, invoice.totalCents);
  if (invoice.jobId) await syncJobInvoicingStatus(tx, invoice.jobId);

  await tx.auditLog.create({
    data: { tenantId, userId, action: 'payment.recorded', entityType: 'Invoice', entityId: invoiceId, details: { amountCents, method } },
  });

  return { ok: true };
}

/**
 * Corrects a wrongly recorded payment. The row is kept, never deleted — only
 * marked reversed — so there's always a trail of what happened. If money is
 * still owed, a fresh payment is recorded separately.
 */
export async function reversePayment(
  tx: Prisma.TransactionClient,
  args: { tenantId: string; paymentId: string; userId: string }
): Promise<{ error: string } | { ok: true }> {
  const { tenantId, paymentId, userId } = args;

  const payment = await tx.payment.findFirst({ where: { id: paymentId, tenantId } });
  if (!payment) return { error: 'Payment not found.' };

  // Lock the invoice row (the same row recordPayment locks) before rechecking
  // the payment, so a reversal can't race a fresh payment on the same invoice.
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Invoice" WHERE "id" = ${payment.invoiceId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  if (locked.length === 0) return { error: 'Invoice not found.' };

  const fresh = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (fresh.reversedAt) return { error: 'This payment has already been reversed.' };

  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId }, select: { totalCents: true, jobId: true } });

  await tx.payment.update({ where: { id: paymentId }, data: { reversedAt: new Date() } });
  await recalcInvoice(tx, payment.invoiceId, invoice.totalCents);
  if (invoice.jobId) await syncJobInvoicingStatus(tx, invoice.jobId);

  await tx.auditLog.create({
    data: { tenantId, userId, action: 'payment.reversed', entityType: 'Invoice', entityId: payment.invoiceId, details: { paymentId, amountCents: fresh.amountCents } },
  });

  return { ok: true };
}
