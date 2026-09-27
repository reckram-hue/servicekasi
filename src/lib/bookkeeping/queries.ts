import 'server-only';
import type { TenantDb } from '@/lib/db';
import { ledgerAccountBalance, moneyAccountLedgerKind } from '@/lib/bookkeeping/ledger';

export async function moneyAccountsWithBalances(db: TenantDb) {
  const accounts = await db.moneyAccount.findMany({
    where: { archived: false },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, type: true, ledgerAccountId: true, openingDate: true },
  });
  return Promise.all(
    accounts.map(async (a) => ({ ...a, balanceCents: await ledgerAccountBalance(db, a.ledgerAccountId, moneyAccountLedgerKind(a.type)) }))
  );
}

export async function activeExpenseCategories(db: TenantDb) {
  return db.expenseCategory.findMany({ where: { archived: false }, orderBy: { name: 'asc' } });
}

export async function recentExpenses(db: TenantDb, take = 20) {
  return db.expense.findMany({
    orderBy: { date: 'desc' },
    take,
    include: { category: { select: { name: true } }, moneyAccount: { select: { name: true } } },
  });
}

export async function monthExpenseTotalCents(db: TenantDb, start: Date, end: Date): Promise<number> {
  const agg = await db.expense.aggregate({ where: { date: { gte: start, lt: end } }, _sum: { amountCents: true } });
  return agg._sum.amountCents ?? 0;
}

export async function monthExpenseCount(db: TenantDb, start: Date, end: Date): Promise<number> {
  return db.expense.count({ where: { date: { gte: start, lt: end } } });
}

/**
 * Money in from paid invoices this month (decision 6). Reads the "Sales
 * income" ledger account's own activity rather than filtering by
 * sourceType — a reversed payment posts as a CORRECTION entry (decision 5),
 * not an INVOICE_REFUND, but it still touches this same account, so netting
 * by account rather than by label keeps a reversal from being missed.
 */
export async function monthInvoiceIncomeCents(db: TenantDb, tenantId: string, start: Date, end: Date): Promise<number> {
  const sales = await db.ledgerAccount.findUnique({ where: { tenantId_code: { tenantId, code: 'SALES' } } });
  if (!sales) return 0;
  const [credit, debit] = await Promise.all([
    db.journalEntry.aggregate({ where: { creditAccountId: sales.id, date: { gte: start, lt: end } }, _sum: { amountCents: true } }),
    db.journalEntry.aggregate({ where: { debitAccountId: sales.id, date: { gte: start, lt: end } }, _sum: { amountCents: true } }),
  ]);
  return (credit._sum.amountCents ?? 0) - (debit._sum.amountCents ?? 0);
}

/** One money account's history: every journal entry touching it, oldest first, with a running balance. */
export async function moneyAccountHistory(
  db: TenantDb,
  moneyAccount: { ledgerAccountId: string; type: import('@prisma/client').MoneyAccountType; openingBalanceCents: number; openingDate: Date }
) {
  const kind = moneyAccountLedgerKind(moneyAccount.type);
  const entries = await db.journalEntry.findMany({
    where: { OR: [{ debitAccountId: moneyAccount.ledgerAccountId }, { creditAccountId: moneyAccount.ledgerAccountId }] },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, date: true, memo: true, amountCents: true, debitAccountId: true, sourceType: true },
  });

  let running = 0;
  const rows = entries.map((e) => {
    const isDebit = e.debitAccountId === moneyAccount.ledgerAccountId;
    const signedForAccount = (kind === 'ASSET' ? 1 : -1) * (isDebit ? 1 : -1) * e.amountCents;
    running += signedForAccount;
    return { id: e.id, date: e.date, memo: e.memo, sourceType: e.sourceType, amountCents: signedForAccount, runningBalanceCents: running };
  });
  return rows;
}

/** "Who I owe" — every bill not yet fully paid, oldest due date first. */
export async function openBills(db: TenantDb) {
  return db.bill.findMany({
    where: { status: { not: 'PAID' } },
    orderBy: { dueDate: 'asc' },
    include: { category: { select: { name: true } } },
  });
}

export async function billWithPayments(db: TenantDb, id: string) {
  return db.bill.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      billPayments: { orderBy: { date: 'asc' }, include: { moneyAccount: { select: { name: true } } } },
    },
  });
}
