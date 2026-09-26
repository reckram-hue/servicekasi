import type { InvoiceStatus } from '@prisma/client';
import { isValidUntilPassed } from '@/lib/dates';

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Unpaid',
  PARTIALLY_PAID: 'Part-paid',
  PAID: 'Paid',
  VOID: 'Void',
};

export const INVOICE_STATUS_STYLES: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-slate-800 text-slate-300',
  SENT: 'bg-blue-500/10 text-blue-300',
  PARTIALLY_PAID: 'bg-amber-500/10 text-amber-300',
  PAID: 'bg-emerald-500/10 text-emerald-300',
  VOID: 'bg-red-500/10 text-red-300',
};

/** Money is still owed and the whole due date has passed. */
export function isInvoiceOverdue(inv: { status: InvoiceStatus; dueAt: Date | null }): boolean {
  return (inv.status === 'SENT' || inv.status === 'PARTIALLY_PAID') && isValidUntilPassed(inv.dueAt);
}
