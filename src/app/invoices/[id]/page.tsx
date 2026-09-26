import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { addDaysToDateStr, todayDateStr } from '@/lib/dates';
import { invoiceDocumentProps } from '@/lib/invoices/publicQuery';
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_STYLES, isInvoiceOverdue } from '@/lib/invoices/status';
import { InvoiceBuilder } from '@/components/invoices/InvoiceBuilder';
import { InvoiceDocument } from '@/components/invoices/InvoiceDocument';
import { SendInvoiceButton } from '@/components/invoices/SendInvoiceButton';
import { PrintButton } from '@/components/invoices/PrintButton';

function displayName(c: { firstName: string; lastName: string | null; companyName: string | null }) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return c.companyName ? `${name} (${c.companyName})` : name;
}

function propertyLabel(p: { street: string; suburb: string | null; city: string }) {
  return [p.street, p.suburb, p.city].filter(Boolean).join(', ');
}

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const protocol = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await requireRole();
  const { id } = await params;

  const db = tenantDb(tenant.id);
  const [invoice, catalogItems, origin] = await Promise.all([
    db.invoice.findUnique({
      where: { id },
      include: { client: { include: { properties: true } }, lines: { orderBy: { sortOrder: 'asc' } }, job: true },
    }),
    db.catalogItem.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    siteOrigin(),
  ]);
  if (!invoice) notFound();

  const today = todayDateStr(tenant.timezone);
  const doc = invoice.status === 'DRAFT' ? null : invoiceDocumentProps(invoice, tenant);
  const publicUrl = `${origin}/i/${invoice.publicToken}`;
  const overdue = isInvoiceOverdue(invoice);
  const businessName = tenant.tradingName || tenant.businessName;
  const balanceCents = invoice.totalCents - invoice.paidCents;
  const dueDay = invoice.dueAt?.toISOString().slice(0, 10);
  const dueText =
    dueDay && invoice.issuedAt && dueDay > invoice.issuedAt.toLocaleDateString('en-CA', { timeZone: tenant.timezone })
      ? `, due ${new Date(`${dueDay}T00:00:00Z`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`
      : '';
  const whatsappMessage = `Hi ${invoice.client.firstName}, here's invoice ${invoice.number} from ${businessName} for ${formatMoney(balanceCents, invoice.currencyCode)}${dueText}. View it here: ${publicUrl}`;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl print:max-w-none">
        <Link href="/invoices" className="text-sm text-amber-400 hover:underline print:hidden">
          ← Invoices
        </Link>
        <div className="mt-2 mb-2 flex items-center justify-between print:hidden">
          <h1 className="text-2xl font-bold">
            {invoice.number ?? 'Draft invoice'}
            <span className="ml-2 text-base font-normal text-slate-400">{displayName(invoice.client)}</span>
          </h1>
          <div className="flex items-center gap-2">
            {overdue && <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300">Overdue</span>}
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${INVOICE_STATUS_STYLES[invoice.status]}`}>
              {INVOICE_STATUS_LABELS[invoice.status]}
            </span>
          </div>
        </div>

        {invoice.job && (
          <p className="mb-6 text-sm text-slate-500 print:hidden">
            From job{' '}
            <Link href={`/jobs/${invoice.job.id}`} className="text-amber-400 hover:underline">
              {invoice.job.number}
            </Link>
          </p>
        )}

        {doc ? (
          <>
            <div className="mb-6 print:hidden">
              <SendInvoiceButton publicUrl={publicUrl} clientPhone={invoice.client.phone} message={whatsappMessage} />
            </div>
            <InvoiceDocument {...doc} />
            <div className="mt-4 flex items-center justify-between gap-3 print:hidden">
              <p className="text-xs text-slate-500">Issued invoices are locked. Mistakes are corrected with a credit note.</p>
              <PrintButton className="shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700" />
            </div>
          </>
        ) : (
          <div className="mt-4">
            <InvoiceBuilder
              invoiceId={invoice.id}
              job={invoice.job ? { id: invoice.job.id, number: invoice.job.number } : undefined}
              client={{
                id: invoice.client.id,
                name: displayName(invoice.client),
                properties: invoice.client.properties.map((p) => ({ id: p.id, label: propertyLabel(p) })),
              }}
              tenant={{
                vatRegistered: tenant.vatRegistered,
                defaultTaxRateBp: tenant.defaultTaxRateBp,
                currencyCode: tenant.currencyCode,
                invoiceTerms: tenant.invoiceTerms,
              }}
              catalogItems={catalogItems}
              issue={{
                today,
                defaultDueDate: addDaysToDateStr(today, tenant.defaultPaymentTermsDays),
                isTaxInvoice: tenant.vatRegistered,
              }}
              initial={{
                notes: invoice.notes ?? '',
                propertyId: invoice.propertyId,
                lines: invoice.lines.map((l) => ({
                  key: l.id,
                  catalogItemId: l.catalogItemId ?? undefined,
                  type: l.type,
                  description: l.description,
                  quantity: l.quantity.toString(),
                  unitCostRands: l.unitCostCents ? (l.unitCostCents / 100).toFixed(2) : '',
                  unitPriceRands: (l.unitPriceCents / 100).toFixed(2),
                  taxable: l.taxRateBp > 0,
                })),
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
