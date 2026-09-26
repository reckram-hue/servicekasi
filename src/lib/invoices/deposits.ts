import 'server-only';
import type { Prisma } from '@prisma/client';
import { documentTotals, lineTotals } from '@/lib/money';
import { remainingCreditByLine } from '@/lib/invoices/creditNotes';

const ISSUED = ['SENT', 'PARTIALLY_PAID', 'PAID'] as const;

type QuoteForDeposit = {
  number: string;
  title: string;
  depositCents: number;
  depositPercent: number | null;
  lines: { quantity: { toString(): string }; unitPriceCents: number; taxRateBp: number; optional: boolean; selected: boolean }[];
};

/**
 * The lines of a deposit invoice: the quote's deposit (VAT included) split
 * across the quote's VAT rates in proportion to them, so a deposit on a job
 * with some VAT-free items isn't charged VAT on those.
 */
export function depositLines(quote: QuoteForDeposit): Prisma.LineItemCreateWithoutInvoiceInput[] {
  const byRate = new Map<number, number>();
  for (const l of quote.lines) {
    const t = lineTotals({ quantity: Number(l.quantity.toString()), unitPriceCents: l.unitPriceCents, taxRateBp: l.taxRateBp, optional: l.optional, selected: l.selected });
    if (!t.includedInDocument) continue;
    byRate.set(l.taxRateBp, (byRate.get(l.taxRateBp) ?? 0) + t.totalCents);
  }
  const groups = [...byRate.entries()].filter(([, total]) => total > 0).sort(([a], [b]) => b - a);
  const quoteTotal = groups.reduce((sum, [, total]) => sum + total, 0);
  if (quote.depositCents <= 0 || quoteTotal <= 0) return [];

  const label = `Deposit${quote.depositPercent ? ` (${quote.depositPercent}%)` : ''}: ${quote.title} (quote ${quote.number})`;
  let allocated = 0;
  return groups.map(([rate, total], i) => {
    const share = i === groups.length - 1 ? quote.depositCents - allocated : Math.round((quote.depositCents * total) / quoteTotal);
    allocated += share;
    return {
      type: 'SERVICE' as const,
      description: groups.length > 1 && rate === 0 ? `${label}, items without VAT` : label,
      quantity: 1,
      // The deposit is VAT-inclusive; the line holds the amount excl. VAT.
      unitPriceCents: Math.round((share * 10000) / (10000 + rate)),
      unitCostCents: 0,
      taxRateBp: rate,
      sortOrder: i,
    };
  });
}

/**
 * The "Less: deposit" lines for an invoice on this job: one per line of each
 * issued deposit invoice, for what hasn't been credited on it, at the
 * deposit's own VAT rate so VAT is never charged twice. A deposit already
 * deducted on another issued invoice is left out.
 *
 * With `lock`, the deposit rows are locked first (in a fixed order), so a
 * credit note on a deposit, or a second invoice deducting it, can't happen
 * while this invoice is being issued.
 */
export async function depositDeductionRows(
  tx: Prisma.TransactionClient,
  args: { tenantId: string; jobId: string; forInvoiceId: string | null; lock: boolean }
): Promise<Prisma.LineItemCreateWithoutInvoiceInput[]> {
  const { tenantId, jobId, forInvoiceId, lock } = args;
  const ids = lock
    ? (
        await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "Invoice"
          WHERE "tenantId" = ${tenantId} AND "jobId" = ${jobId} AND "isDeposit" = true
            AND "kind" <> 'CREDIT_NOTE' AND "status" IN ('SENT', 'PARTIALLY_PAID', 'PAID')
          ORDER BY "id"
          FOR UPDATE`
      ).map((r) => r.id)
    : undefined;

  const deposits = await tx.invoice.findMany({
    where: {
      tenantId,
      jobId,
      isDeposit: true,
      kind: { not: 'CREDIT_NOTE' },
      status: { in: [...ISSUED] },
      ...(ids ? { id: { in: ids } } : {}),
      ...(forInvoiceId ? { NOT: { id: forInvoiceId } } : {}),
    },
    include: { lines: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { issuedAt: 'asc' },
  });
  if (deposits.length === 0) return [];

  const deductedElsewhere = await tx.lineItem.findMany({
    where: {
      deductsInvoiceId: { in: deposits.map((d) => d.id) },
      invoice: { status: { in: [...ISSUED] }, ...(forInvoiceId ? { NOT: { id: forInvoiceId } } : {}) },
    },
    select: { deductsInvoiceId: true },
  });
  const taken = new Set(deductedElsewhere.map((l) => l.deductsInvoiceId));

  const rows: Prisma.LineItemCreateWithoutInvoiceInput[] = [];
  for (const deposit of deposits) {
    if (taken.has(deposit.id)) continue;
    const remaining = await remainingCreditByLine(tx, deposit.lines);
    for (const line of deposit.lines) {
      const cents = remaining.get(line.id)?.cents ?? 0;
      if (cents <= 0) continue;
      rows.push({
        type: 'SERVICE',
        description: `Less: deposit (${deposit.number})`,
        quantity: 1,
        unitPriceCents: -cents,
        unitCostCents: 0,
        taxRateBp: line.taxRateBp,
        sortOrder: 0,
        deductsInvoiceId: deposit.id,
      });
    }
  }
  return rows;
}

/** The number of an issued invoice on this job that isn't a deposit, if any. */
export async function finalInvoiceIssuedOn(tx: Prisma.TransactionClient, jobId: string): Promise<string | null> {
  const final = await tx.invoice.findFirst({
    where: { jobId, isDeposit: false, kind: { not: 'CREDIT_NOTE' }, status: { in: [...ISSUED] } },
    select: { number: true },
  });
  return final?.number ?? null;
}

/**
 * Whether the job's issued deposits already cover all its work, so a final
 * invoice would be for nothing (e.g. a 100% deposit). Worked out exactly the
 * way a final invoice would be, deduction lines and all.
 */
export async function depositsCoverJob(tx: Prisma.TransactionClient, tenantId: string, jobId: string): Promise<boolean> {
  const deductions = await depositDeductionRows(tx, { tenantId, jobId, forInvoiceId: null, lock: false });
  if (deductions.length === 0) return false;
  const work = await tx.lineItem.findMany({ where: { jobId }, select: { quantity: true, unitPriceCents: true, taxRateBp: true } });
  const totals = documentTotals([
    ...work.map((l) => ({ quantity: Number(l.quantity), unitPriceCents: l.unitPriceCents, taxRateBp: l.taxRateBp })),
    ...deductions.map((l) => ({ quantity: 1, unitPriceCents: l.unitPriceCents, taxRateBp: l.taxRateBp ?? 0 })),
  ]);
  return totals.totalCents <= 0;
}

/** Whether two sets of deduction lines are the same, ignoring order. */
export function sameDeductions(
  a: { deductsInvoiceId?: string | null; unitPriceCents: number; taxRateBp?: number }[],
  b: { deductsInvoiceId?: string | null; unitPriceCents: number; taxRateBp?: number }[]
): boolean {
  const key = (l: (typeof a)[number]) => `${l.deductsInvoiceId}|${l.unitPriceCents}|${l.taxRateBp ?? 0}`;
  const ka = a.map(key).sort();
  const kb = b.map(key).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i]);
}

/**
 * The issued invoice this deposit has been deducted on, if any (and it isn't
 * fully credited). Crediting the deposit as well would give the client the
 * same money back twice.
 */
export async function depositDeductedOn(tx: Prisma.TransactionClient, depositInvoiceId: string): Promise<string | null> {
  const lines = await tx.lineItem.findMany({
    where: { deductsInvoiceId: depositInvoiceId, invoice: { status: { in: [...ISSUED] } } },
    select: { invoice: { select: { number: true, totalCents: true, creditedCents: true } } },
  });
  const active = lines.find((l) => l.invoice && l.invoice.creditedCents < l.invoice.totalCents);
  return active?.invoice?.number ?? null;
}
