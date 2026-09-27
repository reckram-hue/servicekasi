import type { MoneyAccountType, ExpenseVatStatus, JournalSourceType, BillStatus } from '@prisma/client';

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
  BILL_RAISED: 'Bill',
  BILL_PAYMENT: 'Bill payment',
  INVOICE_PAYMENT: 'Invoice payment',
  INVOICE_REFUND: 'Refund',
  CORRECTION: 'Correction',
};

export const BILL_STATUS_LABEL: Record<BillStatus, string> = {
  OPEN: 'Open',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
};

/** Bank/petty cash read as "you have"; a loan/credit card balance reads as "you owe". */
export function isLiabilityType(type: MoneyAccountType): boolean {
  return type === 'LOAN' || type === 'CREDIT_CARD';
}
