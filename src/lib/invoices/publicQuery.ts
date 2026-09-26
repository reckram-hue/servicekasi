import 'server-only';
import { prisma } from '@/lib/prisma';
import type { BuyerSnapshot, SellerSnapshot } from '@/lib/invoices/snapshot';
import type { InvoiceDocumentProps } from '@/components/invoices/InvoiceDocument';

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
  notes: string | null;
  sellerSnapshot: unknown;
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
    notes: inv.notes,
    bank: {
      bankName: tenant.bankName,
      bankAccountHolder: tenant.bankAccountHolder,
      bankAccountNumber: tenant.bankAccountNumber,
      bankBranchCode: tenant.bankBranchCode,
    },
  };
}
