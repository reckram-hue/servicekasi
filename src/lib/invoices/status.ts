import type { InvoiceKind, InvoiceStatus } from '@prisma/client';
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

/** The status badge to show. A credit note isn't paid or unpaid, and an invoice settled only by credit isn't "Paid". */
export function invoiceBadge(inv: { kind: InvoiceKind; status: InvoiceStatus; totalCents: number; creditedCents: number }): { label: string; style: string } {
  if (inv.kind === 'CREDIT_NOTE') return { label: 'Credit note', style: 'bg-purple-500/10 text-purple-300' };
  if (inv.status === 'PAID' && inv.creditedCents >= inv.totalCents) return { label: 'Credited', style: 'bg-slate-800 text-slate-300' };
  return { label: INVOICE_STATUS_LABELS[inv.status], style: INVOICE_STATUS_STYLES[inv.status] };
}

/** Money is still owed and the whole due date has passed. */
export function isInvoiceOverdue(inv: { status: InvoiceStatus; dueAt: Date | null }): boolean {
  return (inv.status === 'SENT' || inv.status === 'PARTIALLY_PAID') && isValidUntilPassed(inv.dueAt);
}
