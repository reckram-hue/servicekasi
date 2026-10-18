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
  'id' | 'industry' | 'logoUrl' | 'addressLine1' | 'city' | 'phone' | 'email' | 'bankName' | 'bankAccountNumber' | 'bankBranchCode'
>;
type ChecklistUser = Pick<User, 'totpEnabled'>;

/** Works out what's left to set up from real data — never a stored flag that could drift. */
export async function getOnboardingChecklist(db: TenantDb, tenant: ChecklistTenant, user: ChecklistUser): Promise<ChecklistItem[]> {
  const mobileCarWash = tenant.industry === 'MOBILE_CAR_WASH';
  const [catalogItemCount, clientCount, quoteSentCount, invoiceIssuedCount, paymentAccount, washCount, teamCount, expenseCount] = await Promise.all([
    db.catalogItem.count(mobileCarWash ? { where: { active: true, unitPriceCents: { gt: 0 }, type: 'SERVICE' } } : undefined),
    db.client.count(),
    db.quote.count({ where: { status: { not: 'DRAFT' } } }),
    db.invoice.count({ where: { status: { not: 'DRAFT' }, kind: { not: 'CREDIT_NOTE' } } }),
    prisma.paymentAccount.findUnique({ where: { tenantId_provider: { tenantId: tenant.id, provider: 'PAYFAST' } } }),
    mobileCarWash ? db.visit.count({ where: { status: { not: 'CANCELLED' } } }) : 0,
    mobileCarWash ? db.membership.count({ where: { role: 'TECHNICIAN', active: true } }) : 0,
    mobileCarWash ? db.expense.count() : 0,
  ]);

  return [
    {
      key: 'business-details',
      label: 'Add your business details',
      description: mobileCarWash ? 'Add your contact number and base town so customers can reach your mobile car wash.' : 'Address and contact details, shown on your quotes and invoices.',
      href: '/settings/business',
      done: !!((mobileCarWash || tenant.addressLine1) && tenant.city && (tenant.phone || tenant.email)),
    },
    {
      key: 'price-list',
      label: mobileCarWash ? 'Set your wash services and prices' : 'Set up your price list',
      description: mobileCarWash ? 'Edit a starter wash service, set your price and activate it. Add car, SUV, detailing or fleet options as needed.' : 'The services and materials you can pick from when building a quote.',
      href: '/settings/price-list',
      done: catalogItemCount > 0,
    },
    {
      key: 'first-client',
      label: mobileCarWash ? 'Add your first wash customer' : 'Add your first client',
      description: 'Their name and contact details.',
      href: '/clients',
      done: clientCount > 0,
    },
    ...(mobileCarWash ? [
      { key: 'first-wash', label: 'Schedule your first wash', description: 'Create a wash for a customer, note the vehicle and address, then add a visit with its date, time and wash team.', href: '/jobs', done: washCount > 0 },
      { key: 'wash-team', label: 'Add your wash team', description: 'Add your employees with their cellphone numbers. You can also assign yourself to washes.', href: '/team', done: teamCount > 0, optional: true },
      { key: 'business-logo', label: 'Add your car wash logo', description: 'Use your own branding on your workspace, booking page, quotes and invoices.', href: '/settings/business', done: !!tenant.logoUrl, optional: true },
      { key: 'first-cost', label: 'Log your first running cost', description: 'Record labour, detergents, fuel or vehicle maintenance in your bookkeeping.', href: '/bookkeeping/expenses/new', done: expenseCount > 0, optional: true },
    ] : []),
    {
      key: 'first-quote',
      label: 'Send your first quote',
      description: 'A quote your client can approve online, no login needed.',
      href: '/quotes',
      done: quoteSentCount > 0,
      ...(mobileCarWash ? { optional: true } : {}),
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
