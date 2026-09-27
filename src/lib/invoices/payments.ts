import 'server-only';
import type { Prisma, PaymentMethod } from '@prisma/client';
import { syncJobInvoicingStatus } from '@/lib/jobs/status';
import { asLedgerDb, postInvoicePaymentEntry, postInvoiceRefundEntry, reverseJournalEntry } from '@/lib/bookkeeping/ledger';

/** What's still owed. Negative means the client has overpaid (e.g. credited after paying) and a refund is due. */
export function invoiceBalanceCents(inv: { totalCents: number; creditedCents: number; paidCents: number }): number {
  return inv.totalCents - inv.creditedCents - inv.paidCents;
}

function statusFromBalance(totalCents: number, creditedCents: number, paidCents: number): 'SENT' | 'PARTIALLY_PAID' | 'PAID' {
  if (paidCents + creditedCents >= totalCents) return 'PAID';
  return paidCents > 0 ? 'PARTIALLY_PAID' : 'SENT';
}

/**
 * Recomputes an invoice's paid (net of refunds) and credited amounts from
 * scratch, then its status. Caller must already hold the invoice row lock.
 */
export async function recalcInvoiceBalance(tx: Prisma.TransactionClient, invoiceId: string): Promise<void> {
  const [invoice, paid, credited] = await Promise.all([
    tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { totalCents: true, jobId: true } }),
    tx.payment.aggregate({ where: { invoiceId, status: 'SUCCEEDED', reversedAt: null }, _sum: { amountCents: true } }),
    tx.invoice.aggregate({ where: { creditsInvoiceId: invoiceId, kind: 'CREDIT_NOTE', status: { not: 'DRAFT' } }, _sum: { totalCents: true } }),
  ]);
  const paidCents = paid._sum.amountCents ?? 0;
  const creditedCents = credited._sum.totalCents ?? 0;
  await tx.invoice.update({
    where: { id: invoiceId },
    data: { paidCents, creditedCents, status: statusFromBalance(invoice.totalCents, creditedCents, paidCents) },
  });
  if (invoice.jobId) await syncJobInvoicingStatus(tx, invoice.jobId);
}

/** Locks an invoice row so payments, refunds, reversals and credit notes on it happen one at a time. */
export async function lockInvoice(tx: Prisma.TransactionClient, tenantId: string, invoiceId: string): Promise<boolean> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  return locked.length > 0;
}

type MoneyEntryArgs = {
  tenantId: string;
  invoiceId: string;
  amountCents: number;
  method: PaymentMethod;
  receivedAt: Date;
  reference: string | null;
  userId: string;
  // Which of the business's own money accounts this landed in — optional; only
  // offered once the owner has started using the cashbook (docs/plans/bookkeeping.md, decision 6).
  moneyAccountId?: string | null;
};

/**
 * Records money the client paid, or (kind "refund") money the business paid
 * back after a credit note left the client overpaid. A refund is stored as a
 * negative payment, so it's reversible and sums like any other entry.
 * The invoice row is locked first, so two entries recorded at the same
 * moment can't both read a stale balance.
 */
export async function recordMoneyEntry(
  tx: Prisma.TransactionClient,
  kind: 'payment' | 'refund',
  args: MoneyEntryArgs
): Promise<{ error: string } | { ok: true }> {
  const { tenantId, invoiceId, amountCents, method, receivedAt, reference, userId, moneyAccountId } = args;

  if (!(await lockInvoice(tx, tenantId, invoiceId))) return { error: 'Invoice not found.' };
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { kind: true, status: true, totalCents: true, creditedCents: true, paidCents: true },
  });
  if (invoice.kind === 'CREDIT_NOTE') return { error: 'Payments are recorded on the invoice, not the credit note.' };
  if (invoice.status === 'DRAFT') return { error: 'This invoice has not been issued yet.' };
  if (invoice.status === 'VOID') return { error: 'This invoice has been voided.' };
  if (amountCents <= 0) return { error: 'Enter an amount more than zero.' };

  const balanceCents = invoiceBalanceCents(invoice);
  if (kind === 'payment') {
    if (balanceCents <= 0) return { error: 'Nothing is owed on this invoice.' };
    if (amountCents > balanceCents) return { error: "That's more than the balance due. Reload the page to see the current balance." };
  } else {
    if (balanceCents >= 0) return { error: 'No refund is due on this invoice.' };
    if (amountCents > -balanceCents) return { error: "That's more than the refund due. Reload the page to see the current amount." };
  }

  const payment = await tx.payment.create({
    data: {
      tenantId,
      invoiceId,
      method,
      status: 'SUCCEEDED',
      amountCents: kind === 'payment' ? amountCents : -amountCents,
      receivedAt,
      reference: reference || undefined,
    },
  });

  if (moneyAccountId) {
    const moneyAccount = await tx.moneyAccount.findFirst({ where: { id: moneyAccountId, tenantId }, select: { ledgerAccountId: true } });
    if (moneyAccount) {
      const db = asLedgerDb(tx);
      const memo = `Invoice payment${reference ? ` — ${reference}` : ''}`;
      const post = kind === 'payment' ? postInvoicePaymentEntry : postInvoiceRefundEntry;
      const entry = await post(db, tenantId, { date: receivedAt, memo, moneyAccountLedgerId: moneyAccount.ledgerAccountId, amountCents });
      await tx.payment.update({ where: { id: payment.id }, data: { moneyAccountId, journalEntryId: entry.id } });
    }
  }

  await recalcInvoiceBalance(tx, invoiceId);

  await tx.auditLog.create({
    data: {
      tenantId,
      userId,
      action: kind === 'payment' ? 'payment.recorded' : 'refund.recorded',
      entityType: 'Invoice',
      entityId: invoiceId,
      details: { amountCents, method },
    },
  });
  return { ok: true };
}

/**
 * Corrects a wrongly recorded payment or refund. The row is kept, never
 * deleted — only marked reversed — so there's always a trail of what
 * happened. If money is still owed, a fresh entry is recorded separately.
 */
export async function reversePayment(
  tx: Prisma.TransactionClient,
  args: { tenantId: string; paymentId: string; userId: string }
): Promise<{ error: string } | { ok: true }> {
  const { tenantId, paymentId, userId } = args;

  const payment = await tx.payment.findFirst({ where: { id: paymentId, tenantId } });
  if (!payment) return { error: 'Payment not found.' };

  // Lock the invoice row before rechecking the payment, so a double-click
  // can't reverse it twice.
  if (!(await lockInvoice(tx, tenantId, payment.invoiceId))) return { error: 'Invoice not found.' };
  const fresh = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (fresh.reversedAt) return { error: 'This payment has already been reversed.' };
  if (fresh.status !== 'SUCCEEDED') return { error: 'Only a received payment can be reversed.' };

  await tx.payment.update({ where: { id: paymentId }, data: { reversedAt: new Date() } });
  if (fresh.journalEntryId) await reverseJournalEntry(asLedgerDb(tx), tenantId, fresh.journalEntryId);
  await recalcInvoiceBalance(tx, payment.invoiceId);

  await tx.auditLog.create({
    data: { tenantId, userId, action: 'payment.reversed', entityType: 'Invoice', entityId: payment.invoiceId, details: { paymentId, amountCents: fresh.amountCents } },
  });
  return { ok: true };
}
