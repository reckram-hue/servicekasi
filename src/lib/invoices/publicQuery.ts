import 'server-only';
import { prisma } from '@/lib/prisma';
import type { BuyerSnapshot, SellerSnapshot } from '@/lib/invoices/snapshot';
import type { InvoiceDocumentProps } from '@/components/invoices/InvoiceDocument';

/** Issued credit notes against an invoice, as the document lists them. Shared with the owner's page. */
export const CREDIT_NOTES_SELECT = {
  where: { kind: 'CREDIT_NOTE', status: { not: 'DRAFT' } },
  select: { number: true, totalCents: true },
  orderBy: { issuedAt: 'asc' },
} as const;

/** On a credit note: the invoice it corrects. */
export const CREDITS_INVOICE_SELECT = { select: { number: true, kind: true } } as const;

/**
 * Looks up an invoice by its public token for the unauthenticated /i/<token>
 * page. There is no logged-in business here, so tenantDb() cannot apply —
 * the unguessable token is what scopes this query.
 *
 * Selects only what the client-facing page shows. Cost prices, margins and
 * internal notes are never selected, so they can't leak to the public page.
 */
export async function getPublicInvoiceByToken(token: string) {
  return prisma.invoice.findUnique({
    where: { publicToken: token },
    select: {
      tenantId: true,
      number: true,
      kind: true,
      status: true,
      issuedAt: true,
      dueAt: true,
      currencyCode: true,
      subtotalCents: true,
      taxCents: true,
      totalCents: true,
      paidCents: true,
      creditedCents: true,
      notes: true,
      sellerSnapshot: true,
      buyerSnapshot: true,
      tenant: {
        select: {
          businessName: true,
          tradingName: true,
          logoUrl: true,
          phone: true,
          email: true,
          timezone: true,
          bankName: true,
          bankAccountHolder: true,
          bankAccountNumber: true,
          bankBranchCode: true,
        },
      },
      lines: {
        select: { id: true, description: true, quantity: true, unitPriceCents: true, taxRateBp: true },
        orderBy: { sortOrder: 'asc' },
      },
      creditNotes: CREDIT_NOTES_SELECT,
      creditsInvoice: CREDITS_INVOICE_SELECT,
    },
  });
}

type IssuedInvoiceFields = {
  number: string | null;
  kind: InvoiceDocumentProps['kind'];
  issuedAt: Date | null;
  dueAt: Date | null;
  currencyCode: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  creditedCents: number;
  notes: string | null;
  sellerSnapshot: unknown;
  creditNotes: { number: string | null; totalCents: number }[];
  creditsInvoice: { number: string | null; kind: InvoiceDocumentProps['kind'] } | null;
  buyerSnapshot: unknown;
  lines: { id: string; description: string; quantity: { toString(): string }; unitPriceCents: number; taxRateBp: number }[];
};

type TenantDocumentFields = {
  timezone: string;
  logoUrl: string | null;
  bankName: string | null;
  bankAccountHolder: string | null;
  bankAccountNumber: string | null;
  bankBranchCode: string | null;
};

/** Props for <InvoiceDocument> from an issued invoice. Null for a draft (nothing to show yet). */
export function invoiceDocumentProps(inv: IssuedInvoiceFields, tenant: TenantDocumentFields): InvoiceDocumentProps | null {
  if (!inv.number || !inv.issuedAt || !inv.sellerSnapshot || !inv.buyerSnapshot) return null;
  return {
    kind: inv.kind,
    number: inv.number,
    issuedAt: inv.issuedAt,
    dueAt: inv.dueAt,
    timeZone: tenant.timezone,
    currencyCode: inv.currencyCode,
    seller: inv.sellerSnapshot as SellerSnapshot,
    buyer: inv.buyerSnapshot as BuyerSnapshot,
    logoUrl: tenant.logoUrl,
    lines: inv.lines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: Number(l.quantity.toString()),
      unitPriceCents: l.unitPriceCents,
      taxRateBp: l.taxRateBp,
    })),
    subtotalCents: inv.subtotalCents,
    taxCents: inv.taxCents,
    totalCents: inv.totalCents,
    paidCents: inv.paidCents,
    creditedCents: inv.creditedCents,
    credits: inv.creditNotes.map((c) => ({ number: c.number ?? '', totalCents: c.totalCents })),
    creditNote:
      inv.kind === 'CREDIT_NOTE' && inv.creditsInvoice
        ? { invoiceNumber: inv.creditsInvoice.number ?? '', vat: inv.creditsInvoice.kind === 'TAX_INVOICE' }
        : null,
    notes: inv.notes,
    bank: {
      bankName: tenant.bankName,
      bankAccountHolder: tenant.bankAccountHolder,
      bankAccountNumber: tenant.bankAccountNumber,
      bankBranchCode: tenant.bankBranchCode,
    },
  };
}
