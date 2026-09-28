import 'server-only';
import type { TenantDb } from '@/lib/db';

export type ProfitAndLoss = {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  lines: { name: string; amountCents: number }[];
};

/**
 * Income is cash actually received on invoices in the period (works even if
 * the cashbook has never been touched). Expenses are accrual — everything
 * posted to an expense category's ledger account in the period, whether it's
 * a plain expense or a bill raised, paid or not — so a bill counts as an
 * expense the moment it's recorded, not only once it's settled.
 */
export async function profitAndLoss(db: TenantDb, start: Date, end: Date): Promise<ProfitAndLoss> {
  const payments = await db.payment.aggregate({
    where: { status: 'SUCCEEDED', reversedAt: null, receivedAt: { gte: start, lt: end } },
    _sum: { amountCents: true },
  });
  const incomeCents = payments._sum.amountCents ?? 0;

  const categories = await db.expenseCategory.findMany({ select: { name: true, ledgerAccountId: true } });
  const ledgerIds = categories.map((c) => c.ledgerAccountId);

  const [debits, credits] = await Promise.all([
    db.journalEntry.groupBy({ by: ['debitAccountId'], where: { date: { gte: start, lt: end }, debitAccountId: { in: ledgerIds } }, _sum: { amountCents: true } }),
    db.journalEntry.groupBy({ by: ['creditAccountId'], where: { date: { gte: start, lt: end }, creditAccountId: { in: ledgerIds } }, _sum: { amountCents: true } }),
  ]);
  const debitMap = new Map(debits.map((d) => [d.debitAccountId, d._sum.amountCents ?? 0]));
  const creditMap = new Map(credits.map((c) => [c.creditAccountId, c._sum.amountCents ?? 0]));

  const lines = categories
    .map((c) => ({ name: c.name, amountCents: (debitMap.get(c.ledgerAccountId) ?? 0) - (creditMap.get(c.ledgerAccountId) ?? 0) }))
    .filter((l) => l.amountCents !== 0)
    .sort((a, b) => b.amountCents - a.amountCents);

  const expenseCents = lines.reduce((sum, l) => sum + l.amountCents, 0);
  return { incomeCents, expenseCents, netCents: incomeCents - expenseCents, lines };
}

export type VatSummary = { outputVatCents: number; inputVatCents: number; netVatCents: number };

/**
 * Figures for the SARS VAT201. Output VAT is the VAT share of cash actually
 * collected on invoices in the period (proportional to each payment, so a
 * partial payment carries its share of the invoice's VAT). Input VAT is
 * back-calculated from VAT-inclusive expenses and bills at the business's
 * standard rate — decision 4 keeps this simple rather than per-line VAT.
 */
export async function vatSummary(db: TenantDb, tenant: { defaultTaxRateBp: number }, start: Date, end: Date): Promise<VatSummary> {
  const payments = await db.payment.findMany({
    where: { status: 'SUCCEEDED', reversedAt: null, receivedAt: { gte: start, lt: end } },
    select: { amountCents: true, invoice: { select: { totalCents: true, taxCents: true } } },
  });
  let outputVatCents = 0;
  for (const p of payments) {
    if (p.invoice.totalCents !== 0) outputVatCents += Math.round((p.invoice.taxCents * p.amountCents) / p.invoice.totalCents);
  }

  const rateBp = tenant.defaultTaxRateBp;
  const [expenses, bills] = await Promise.all([
    db.expense.aggregate({ where: { vatStatus: 'INCLUDES_VAT', date: { gte: start, lt: end } }, _sum: { amountCents: true } }),
    db.bill.aggregate({ where: { vatStatus: 'INCLUDES_VAT', billDate: { gte: start, lt: end } }, _sum: { amountCents: true } }),
  ]);
  const vatInclusiveCents = (expenses._sum.amountCents ?? 0) + (bills._sum.amountCents ?? 0);
  const inputVatCents = rateBp > 0 ? Math.round((vatInclusiveCents * rateBp) / (10_000 + rateBp)) : 0;

  return { outputVatCents, inputVatCents, netVatCents: outputVatCents - inputVatCents };
}
