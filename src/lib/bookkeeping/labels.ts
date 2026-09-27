import type { MoneyAccountType, ExpenseVatStatus, JournalSourceType } from '@prisma/client';

export const MONEY_ACCOUNT_TYPE_LABEL: Record<MoneyAccountType, string> = {
  BANK: 'Bank account',
  PETTY_CASH: 'Petty cash',
  LOAN: 'Loan',
  CREDIT_CARD: 'Credit card',
};

export const VAT_STATUS_LABEL: Record<ExpenseVatStatus, string> = {
  NO_VAT: 'No VAT',
  INCLUDES_VAT: 'Includes VAT',
};

export const JOURNAL_SOURCE_LABEL: Record<JournalSourceType, string> = {
  OPENING_BALANCE: 'Opening balance',
  EXPENSE: 'Expense',
  TRANSFER: 'Transfer',
  CORRECTION: 'Correction',
};

/** Bank/petty cash read as "you have"; a loan/credit card balance reads as "you owe". */
export function isLiabilityType(type: MoneyAccountType): boolean {
  return type === 'LOAN' || type === 'CREDIT_CARD';
}
