import 'server-only';
import { randomUUID } from 'crypto';
import type { LedgerAccountKind, MoneyAccountType } from '@prisma/client';
import type { TenantDb } from '@/lib/db';

/** Bank and petty cash are assets; a loan or credit card balance is money owed — a liability. */
export function moneyAccountLedgerKind(type: MoneyAccountType): LedgerAccountKind {
  return type === 'LOAN' || type === 'CREDIT_CARD' ? 'LIABILITY' : 'ASSET';
}

/** Every tenant's single "where opening balances come from" account, created the first time it's needed. */
export async function openingBalanceEquityAccount(db: TenantDb, tenantId: string) {
  return db.ledgerAccount.upsert({
    where: { tenantId_code: { tenantId, code: 'OBE' } },
    create: { tenantId, kind: 'EQUITY', code: 'OBE', name: 'Opening balance equity' },
    update: {},
  });
}

/** The balance of an account, in the sign a person reads naturally: positive money in a bank account, positive amount still owed on a loan. */
export async function ledgerAccountBalance(db: TenantDb, ledgerAccountId: string, kind: LedgerAccountKind): Promise<number> {
  const [debit, credit] = await Promise.all([
    db.journalEntry.aggregate({ where: { debitAccountId: ledgerAccountId }, _sum: { amountCents: true } }),
    db.journalEntry.aggregate({ where: { creditAccountId: ledgerAccountId }, _sum: { amountCents: true } }),
  ]);
  const debitTotal = debit._sum.amountCents ?? 0;
  const creditTotal = credit._sum.amountCents ?? 0;
  return kind === 'ASSET' || kind === 'EXPENSE' ? debitTotal - creditTotal : creditTotal - debitTotal;
}

/** Creates a money account and, if it doesn't start at zero, the opening-balance journal entry that backs it. */
export async function createMoneyAccountWithOpeningBalance(
  db: TenantDb,
  tenantId: string,
  input: { type: MoneyAccountType; name: string; openingBalanceCents: number; openingDate: Date }
) {
  const kind = moneyAccountLedgerKind(input.type);
  const ledgerAccount = await db.ledgerAccount.create({
    data: { tenantId, kind, code: `MA-${randomUUID().slice(0, 8)}`, name: input.name },
  });
  const moneyAccount = await db.moneyAccount.create({
    data: {
      tenantId,
      ledgerAccountId: ledgerAccount.id,
      type: input.type,
      name: input.name,
      openingBalanceCents: input.openingBalanceCents,
      openingDate: input.openingDate,
    },
  });

  if (input.openingBalanceCents > 0) {
    const obe = await openingBalanceEquityAccount(db, tenantId);
    const isAsset = kind === 'ASSET';
    await db.journalEntry.create({
      data: {
        tenantId,
        date: input.openingDate,
        memo: `Opening balance — ${input.name}`,
        debitAccountId: isAsset ? ledgerAccount.id : obe.id,
        creditAccountId: isAsset ? obe.id : ledgerAccount.id,
        amountCents: input.openingBalanceCents,
        sourceType: 'OPENING_BALANCE',
      },
    });
  }

  return moneyAccount;
}

/** Records an expense: debits the category (an expense goes up), credits the money account it was paid from. */
export async function postExpenseEntry(
  db: TenantDb,
  tenantId: string,
  input: { date: Date; memo: string; categoryLedgerAccountId: string; moneyAccountLedgerId: string; amountCents: number }
) {
  return db.journalEntry.create({
    data: {
      tenantId,
      date: input.date,
      memo: input.memo,
      debitAccountId: input.categoryLedgerAccountId,
      creditAccountId: input.moneyAccountLedgerId,
      amountCents: input.amountCents,
      sourceType: 'EXPENSE',
    },
  });
}

/**
 * Moves money between two money accounts: debits the destination, credits the
 * source. This single rule is correct whether both sides are assets (bank →
 * petty cash), or the destination is a liability (bank → loan repayment),
 * because a debit's effect always depends on the account's own kind.
 *
 * An optional interest portion (a loan repayment split) posts as a second,
 * linked entry: it debits the interest expense category instead of the loan,
 * so only the true principal reduces what's owed.
 */
export async function postTransfer(
  db: TenantDb,
  tenantId: string,
  input: {
    date: Date;
    memo: string;
    fromLedgerAccountId: string;
    toLedgerAccountId: string;
    principalCents: number;
    interestCents?: number;
    interestCategoryLedgerAccountId?: string;
  }
) {
  const transferGroupId = randomUUID();
  const entries = [
    db.journalEntry.create({
      data: {
        tenantId,
        date: input.date,
        memo: input.memo,
        debitAccountId: input.toLedgerAccountId,
        creditAccountId: input.fromLedgerAccountId,
        amountCents: input.principalCents,
        sourceType: 'TRANSFER',
        transferGroupId,
      },
    }),
  ];

  if (input.interestCents && input.interestCents > 0 && input.interestCategoryLedgerAccountId) {
    entries.push(
      db.journalEntry.create({
        data: {
          tenantId,
          date: input.date,
          memo: `${input.memo} — interest`,
          debitAccountId: input.interestCategoryLedgerAccountId,
          creditAccountId: input.fromLedgerAccountId,
          amountCents: input.interestCents,
          sourceType: 'TRANSFER',
          transferGroupId,
        },
      })
    );
  }

  return Promise.all(entries);
}
