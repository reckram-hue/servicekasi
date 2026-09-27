import 'server-only';
import type { Tenant, User } from '@prisma/client';
import type { TenantDb } from '@/lib/db';
import { prisma } from '@/lib/prisma';

export type ChecklistItem = {
  key: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
  optional?: boolean;
};

type ChecklistTenant = Pick<
  Tenant,
  'id' | 'addressLine1' | 'city' | 'phone' | 'email' | 'bankName' | 'bankAccountNumber' | 'bankBranchCode'
>;
type ChecklistUser = Pick<User, 'totpEnabled'>;

/** Works out what's left to set up from real data — never a stored flag that could drift. */
export async function getOnboardingChecklist(db: TenantDb, tenant: ChecklistTenant, user: ChecklistUser): Promise<ChecklistItem[]> {
  const [catalogItemCount, clientCount, quoteSentCount, invoiceIssuedCount, paymentAccount] = await Promise.all([
    db.catalogItem.count(),
    db.client.count(),
    db.quote.count({ where: { status: { not: 'DRAFT' } } }),
    db.invoice.count({ where: { status: { not: 'DRAFT' }, kind: { not: 'CREDIT_NOTE' } } }),
    prisma.paymentAccount.findUnique({ where: { tenantId_provider: { tenantId: tenant.id, provider: 'PAYFAST' } } }),
  ]);

  return [
    {
      key: 'business-details',
      label: 'Add your business details',
      description: 'Address and contact details, shown on your quotes and invoices.',
      href: '/settings/business',
      done: !!(tenant.addressLine1 && tenant.city && (tenant.phone || tenant.email)),
    },
    {
      key: 'price-list',
      label: 'Set up your price list',
      description: 'The services and materials you can pick from when building a quote.',
      href: '/settings/price-list',
      done: catalogItemCount > 0,
    },
    {
      key: 'first-client',
      label: 'Add your first client',
      description: 'Their name and contact details.',
      href: '/clients',
      done: clientCount > 0,
    },
    {
      key: 'first-quote',
      label: 'Send your first quote',
      description: 'A quote your client can approve online, no login needed.',
      href: '/quotes',
      done: quoteSentCount > 0,
    },
    {
      key: 'first-invoice',
      label: 'Issue your first invoice',
      description: 'A numbered invoice with a link your client can pay or view.',
      href: '/invoices',
      done: invoiceIssuedCount > 0,
    },
    {
      key: 'bank-details',
      label: 'Add your banking details',
      description: 'So clients paying by EFT know where to send the money.',
      href: '/settings/business',
      done: !!(tenant.bankName && tenant.bankAccountNumber && tenant.bankBranchCode),
    },
    {
      key: 'online-payments',
      label: 'Connect online payments',
      description: 'Let clients pay by card, Instant EFT or Capitec Pay straight from their invoice.',
      href: '/settings/payments',
      done: !!paymentAccount?.enabled,
      optional: true,
    },
    {
      key: 'authenticator',
      label: 'Protect your account with an authenticator app',
      description: 'Your login can see money, bank details and customer information.',
      href: '/settings/security',
      done: user.totpEnabled,
    },
  ];
}

/** True once every non-optional item is done — used to decide whether "Getting started" still needs a way back in. */
export function isChecklistComplete(items: ChecklistItem[]): boolean {
  return items.every((i) => i.done || i.optional);
}
