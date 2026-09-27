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
