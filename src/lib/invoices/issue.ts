import 'server-only';
import type { Prisma } from '@prisma/client';
import { nextDocumentNumber } from '@/lib/db';
import { documentTotals, formatMoney } from '@/lib/money';
import { buildBuyerSnapshot, buildSellerSnapshot, tenantAddressLines } from '@/lib/invoices/snapshot';
import { depositDeductionRows, finalInvoiceIssuedOn, sameDeductions } from '@/lib/invoices/deposits';

/** SARS: a tax invoice over R5 000 (VAT included) must also show the client's name, address and VAT number. */
const ZA_FULL_TAX_INVOICE_OVER_CENTS = 500_000;

/**
 * Issues a draft: checks it is complete, allocates the next invoice number,
 * freezes the seller/buyer details and locks it. Must run inside a
 * transaction so a failure after the number is allocated gives the number
 * back, keeping the sequence gap-free.
 *
 * The draft row is locked first, so a double-click (or an edit arriving at
 * the same moment) waits here and then finds the invoice is no longer a
 * draft, instead of issuing twice or changing lines after issue.
 */
export async function issueInvoice(
  tx: Prisma.TransactionClient,
  args: { tenantId: string; invoiceId: string; dueDate: string; userId: string }
): Promise<{ error: string } | { number: string }> {
  const { tenantId, invoiceId, dueDate, userId } = args;

  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Invoice"
    WHERE "id" = ${invoiceId} AND "tenantId" = ${tenantId} AND "status" = 'DRAFT'
    FOR UPDATE`;
  if (locked.length === 0) return { error: 'This invoice has already been issued.' };

  const [invoice, tenant] = await Promise.all([
    tx.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { lines: true, client: true, property: true },
    }),
    tx.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
  ]);
  if (!invoice) return { error: 'Invoice not found.' };

  // "Less: deposit" lines keep the deposit's own VAT rate, so they're checked separately below.
  const workLines = invoice.lines.filter((l) => !l.deductsInvoiceId);
  if (workLines.length === 0) return { error: 'Add at least one line before issuing.' };

  if (invoice.jobId) {
    // Invoices on one job are issued one at a time, so a deposit and the final
    // invoice issued at the same moment can't each miss the other.
    await tx.$queryRaw`SELECT 1 AS ok FROM (SELECT pg_advisory_xact_lock(hashtext(${invoice.jobId}))) AS l`;
  }
  if (invoice.jobId && invoice.isDeposit) {
    const finalNumber = await finalInvoiceIssuedOn(tx, invoice.jobId);
    if (finalNumber) {
      return { error: `Invoice ${finalNumber} for this job has already been issued without deducting this deposit, so issuing it now would bill the client twice. Delete this draft.` };
    }
  }
  if (invoice.jobId && !invoice.isDeposit) {
    const current = await depositDeductionRows(tx, { tenantId, jobId: invoice.jobId, forInvoiceId: invoiceId, lock: true });
    const onDraft = invoice.lines.filter((l) => l.deductsInvoiceId);
    if (!sameDeductions(current, onDraft)) {
      return { error: "The job's deposit has changed since this draft was saved. Save the draft again to update the deposit deducted, then issue." };
    }
  }

  // Lines carry the VAT rate from when the draft was last saved. If the rate
  // has changed since, re-saving recalculates them.
  const expectedRate = tenant.vatRegistered ? tenant.defaultTaxRateBp : 0;
  if (workLines.some((l) => l.taxRateBp !== 0 && l.taxRateBp !== expectedRate)) {
    return { error: 'Your VAT settings have changed since this draft was saved. Check the lines and save it again before issuing.' };
  }
  // Lines copied from a quote or job made before the business registered for
  // VAT arrive at 0% with their VAT box unticked, and re-saving keeps them so.
  if (tenant.vatRegistered && workLines.every((l) => l.taxRateBp === 0)) {
    return { error: 'No VAT is charged on any line, but this will be a tax invoice. Tick "VAT" on the lines VAT applies to, then issue again.' };
  }

  const totals = documentTotals(
    invoice.lines.map((l) => ({ quantity: Number(l.quantity), unitPriceCents: l.unitPriceCents, taxRateBp: l.taxRateBp }))
  );
  if (totals.totalCents <= 0) {
    return {
      error: workLines.length < invoice.lines.length
        ? 'The deposit already covers everything on this job, so no further invoice is needed. Delete this draft; the job is completed once the deposit is paid.'
        : 'An invoice must be for more than zero.',
    };
  }

  const isTaxInvoice = tenant.vatRegistered;
  if (isTaxInvoice) {
    if (!tenant.vatNumber) return { error: 'Tax invoices must show your VAT number. Add it in Business settings first.' };
    if (tenantAddressLines(tenant).length === 0) {
      return { error: 'Tax invoices must show your business address. Add it in Business settings first.' };
    }
    if (tenant.countryCode === 'ZA' && totals.totalCents > ZA_FULL_TAX_INVOICE_OVER_CENTS && !invoice.property) {
      return {
        error: `Tax invoices over ${formatMoney(ZA_FULL_TAX_INVOICE_OVER_CENTS, tenant.currencyCode, false)} must show the client's address. Choose the client's property on this invoice.`,
      };
    }
  }

  const number = await nextDocumentNumber(tx, tenantId, 'INVOICE');

  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      number,
      kind: isTaxInvoice ? 'TAX_INVOICE' : 'INVOICE',
      status: 'SENT',
      issuedAt: new Date(),
      dueAt: new Date(dueDate), // "YYYY-MM-DD" → UTC midnight, like Quote.validUntil
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      sellerSnapshot: buildSellerSnapshot(tenant),
      buyerSnapshot: buildBuyerSnapshot(invoice.client, invoice.property),
    },
  });

  await tx.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'invoice.issued',
      entityType: 'Invoice',
      entityId: invoiceId,
      details: { number, totalCents: totals.totalCents },
    },
  });

  return { number };
}
