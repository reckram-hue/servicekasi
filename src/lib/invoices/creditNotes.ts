import 'server-only';
import type { Prisma } from '@prisma/client';
import { nextDocumentNumber } from '@/lib/db';
import { formatMoney, lineTotals } from '@/lib/money';
import { lockInvoice, recalcInvoiceBalance } from '@/lib/invoices/payments';
import { depositDeductedOn } from '@/lib/invoices/deposits';

type CreditableLine = { id: string; quantity: { toString(): string }; unitPriceCents: number; taxRateBp: number };

export type RemainingCredit = { cents: number; vatCents: number };

/**
 * Each invoice line's amount excl. VAT, and VAT, not yet credited, by line id.
 * Every earlier credit on a line was a part-credit (a credit that uses up the
 * line is its last), so its VAT is recomputed from its amount exactly as it
 * was when issued.
 */
export async function remainingCreditByLine(tx: Prisma.TransactionClient, lines: CreditableLine[]): Promise<Map<string, RemainingCredit>> {
  const prior = await tx.lineItem.findMany({
    where: { creditsLineItemId: { in: lines.map((l) => l.id) } },
    select: { creditsLineItemId: true, unitPriceCents: true, taxRateBp: true },
  });
  return new Map(
    lines.map((l) => {
      const original = lineTotals({ quantity: Number(l.quantity.toString()), unitPriceCents: l.unitPriceCents, taxRateBp: l.taxRateBp });
      let cents = original.subtotalCents;
      let vatCents = original.taxCents;
      for (const p of prior.filter((c) => c.creditsLineItemId === l.id)) {
        const t = lineTotals({ quantity: 1, unitPriceCents: p.unitPriceCents, taxRateBp: p.taxRateBp });
        cents -= t.subtotalCents;
        vatCents -= t.taxCents;
      }
      return [l.id, { cents: Math.max(0, cents), vatCents: Math.max(0, vatCents) }];
    })
  );
}

/**
 * The VAT to credit on one credit note line. A credit that uses up what's
 * left of a line credits exactly the VAT left on it, so part-credits whose
 * roundings add up differently can never leave a cent stuck or over-credit.
 */
export function creditLineVatCents(amountCents: number, taxRateBp: number, remaining: RemainingCredit): number {
  if (amountCents === remaining.cents) return remaining.vatCents;
  return lineTotals({ quantity: 1, unitPriceCents: amountCents, taxRateBp }).taxCents;
}

/**
 * Issues a credit note against an issued invoice: numbered from its own
 * gap-free sequence (CN-0001), locked from the moment it exists, and it
 * reduces what's owed on the invoice. Each credit note line credits an
 * amount (excl. VAT) of one invoice line at that line's original VAT rate,
 * never more than is left uncredited on it.
 *
 * Runs inside a transaction with the invoice row locked, so two credit notes
 * (or a credit note and a payment) can't both work from a stale balance.
 */
export async function issueCreditNote(
  tx: Prisma.TransactionClient,
  args: { tenantId: string; invoiceId: string; reason: string; credits: { lineItemId: string; amountCents: number }[]; userId: string }
): Promise<{ error: string } | { id: string; number: string }> {
  const { tenantId, invoiceId, reason, credits, userId } = args;

  if (!(await lockInvoice(tx, tenantId, invoiceId))) return { error: 'Invoice not found.' };
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { lines: { orderBy: { sortOrder: 'asc' } } },
  });
  if (invoice.kind === 'CREDIT_NOTE') return { error: "A credit note can't itself be credited." };
  if (invoice.status === 'DRAFT') return { error: "A draft isn't issued yet — edit or delete it instead." };
  if (invoice.status === 'VOID') return { error: 'This invoice has been voided.' };
  if (!invoice.number || !invoice.sellerSnapshot || !invoice.buyerSnapshot) return { error: 'This invoice is missing its issued details.' };
  if (invoice.isDeposit) {
    const deductedOn = await depositDeductedOn(tx, invoice.id);
    if (deductedOn) return { error: `This deposit is already deducted on invoice ${deductedOn}. Credit that invoice instead.` };
  }

  const remaining = await remainingCreditByLine(tx, invoice.lines);
  const chosen = credits.filter((c) => c.amountCents > 0);
  if (chosen.length === 0) return { error: 'Enter an amount to credit on at least one line.' };
  // Each line's cap is checked on its own, so a line listed twice could exceed it.
  if (new Set(chosen.map((c) => c.lineItemId)).size !== chosen.length) return { error: 'Each line can only be credited once per credit note.' };

  const rows: Prisma.LineItemCreateWithoutInvoiceInput[] = [];
  let subtotalCents = 0;
  let taxCents = 0;
  for (const c of chosen) {
    const line = invoice.lines.find((l) => l.id === c.lineItemId);
    if (!line) return { error: 'One of the lines is not on this invoice.' };
    const left = remaining.get(line.id) ?? { cents: 0, vatCents: 0 };
    if (!Number.isInteger(c.amountCents) || c.amountCents > left.cents) {
      const leftText = formatMoney(left.cents, invoice.currencyCode);
      return { error: `"${line.description}" has only ${leftText} (excl. VAT) left to credit.` };
    }
    subtotalCents += c.amountCents;
    taxCents += creditLineVatCents(c.amountCents, line.taxRateBp, left);
    rows.push({
      type: line.type,
      description: line.description,
      quantity: 1,
      unitPriceCents: c.amountCents,
      unitCostCents: 0,
      // The VAT originally charged on this line is what gets credited back.
      taxRateBp: line.taxRateBp,
      sortOrder: rows.length,
      creditsLineItemId: line.id,
    });
  }

  const totals = { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
  // Safety net: credits can never add up to more than the invoice.
  if (invoice.creditedCents + totals.totalCents > invoice.totalCents) {
    const left = formatMoney(Math.max(0, invoice.totalCents - invoice.creditedCents), invoice.currencyCode);
    return { error: `Only ${left} (incl. VAT) is left to credit on this invoice.` };
  }

  const number = await nextDocumentNumber(tx, tenantId, 'CREDIT_NOTE');
  const creditNote = await tx.invoice.create({
    data: {
      tenantId,
      kind: 'CREDIT_NOTE',
      number,
      clientId: invoice.clientId,
      propertyId: invoice.propertyId,
      creditsInvoiceId: invoice.id,
      status: 'SENT',
      issuedAt: new Date(),
      currencyCode: invoice.currencyCode,
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      // It corrects that invoice, so it carries the same seller and client details.
      sellerSnapshot: invoice.sellerSnapshot,
      buyerSnapshot: invoice.buyerSnapshot,
      notes: reason,
      lines: { create: rows },
    },
  });

  await recalcInvoiceBalance(tx, invoice.id);

  await tx.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'credit_note.issued',
      entityType: 'Invoice',
      entityId: creditNote.id,
      details: { number, creditsInvoice: invoice.number, totalCents: totals.totalCents },
    },
  });

  return { id: creditNote.id, number };
}
