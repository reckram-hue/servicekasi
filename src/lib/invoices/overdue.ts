import 'server-only';
import type { TenantDb } from '@/lib/db';
import { invoiceBalanceCents } from '@/lib/invoices/payments';
import { isValidUntilPassed } from '@/lib/dates';

type OverdueBucket = '0–30 days' | '31–60 days' | '60+ days';

/** Whole days since the due date passed (0 on the first overdue day). */
export function daysOverdue(dueAt: Date): number {
  return Math.floor((Date.now() - dueAt.getTime()) / 86_400_000);
}

export function overdueBucket(days: number): OverdueBucket {
  if (days <= 30) return '0–30 days';
  if (days <= 60) return '31–60 days';
  return '60+ days';
}

/** Every issued, unpaid invoice (not a credit note) — the base set for both the dashboard totals and the overdue list. */
async function unpaidInvoices(db: TenantDb) {
  return db.invoice.findMany({
    where: { kind: { not: 'CREDIT_NOTE' }, status: { in: ['SENT', 'PARTIALLY_PAID'] } },
    select: { id: true, totalCents: true, creditedCents: true, paidCents: true, dueAt: true },
  });
}

/** Total outstanding and overdue across the whole business — for the dashboard card. */
export async function moneyOwedSummary(db: TenantDb): Promise<{ outstandingCents: number; overdueCents: number; overdueCount: number }> {
  const unpaid = await unpaidInvoices(db);
  let outstandingCents = 0;
  let overdueCents = 0;
  let overdueCount = 0;
  for (const inv of unpaid) {
    const balance = invoiceBalanceCents(inv);
    outstandingCents += balance;
    if (isValidUntilPassed(inv.dueAt)) {
      overdueCents += balance;
      overdueCount += 1;
    }
  }
  return { outstandingCents, overdueCents, overdueCount };
}

/** Overdue invoices with client and balance, oldest due date first — for the reminders list. */
export async function overdueInvoiceList(db: TenantDb) {
  const invoices = await db.invoice.findMany({
    where: { kind: { not: 'CREDIT_NOTE' }, status: { in: ['SENT', 'PARTIALLY_PAID'] }, dueAt: { not: null } },
    include: { client: true },
    orderBy: { dueAt: 'asc' },
  });
  return invoices
    .filter((inv) => isValidUntilPassed(inv.dueAt))
    .map((inv) => ({ ...inv, balanceCents: invoiceBalanceCents(inv), daysOverdue: daysOverdue(inv.dueAt!) }));
}
