import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { InvoiceBuilder } from '@/components/invoices/InvoiceBuilder';

function displayName(c: { firstName: string; lastName: string | null; companyName: string | null }) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return c.companyName ? `${name} (${c.companyName})` : name;
}

function propertyLabel(p: { street: string; suburb: string | null; city: string }) {
  return [p.street, p.suburb, p.city].filter(Boolean).join(', ');
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-800 text-slate-300',
  SENT: 'bg-blue-500/10 text-blue-300',
  PARTIALLY_PAID: 'bg-amber-500/10 text-amber-300',
  PAID: 'bg-emerald-500/10 text-emerald-300',
  VOID: 'bg-red-500/10 text-red-300',
};

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await requireRole();
  const { id } = await params;

  const db = tenantDb(tenant.id);
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { client: { include: { properties: true } }, lines: { orderBy: { sortOrder: 'asc' } }, job: true },
  });
  if (!invoice) notFound();

  const isDraft = invoice.status === 'DRAFT';

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <Link href="/invoices" className="text-sm text-amber-400 hover:underline">
          ← Invoices
        </Link>
        <div className="mt-2 mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{invoice.number ?? 'Draft invoice'}</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[invoice.status] ?? 'bg-slate-800 text-slate-300'}`}>
            {invoice.status.replace('_', ' ')}
          </span>
        </div>

        {invoice.job && (
          <p className="mb-6 text-sm text-slate-500">
            From job{' '}
            <Link href={`/jobs/${invoice.job.id}`} className="text-amber-400 hover:underline">
              {invoice.job.number}
            </Link>
          </p>
        )}

        {isDraft ? (
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
            catalogItems={await db.catalogItem.findMany({ where: { active: true }, orderBy: { name: 'asc' } })}
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
        ) : (
          <>
            <p className="mb-6 rounded-lg bg-slate-800/50 px-3 py-2 text-sm text-slate-400">
              This invoice has been issued and is locked. Correct it with a credit note.
            </p>
            <div className="mb-6 rounded-xl border border-slate-800 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Client</div>
              <div className="font-medium text-slate-100">{displayName(invoice.client)}</div>
            </div>
            <div className="mb-6 rounded-xl border border-slate-800 p-4">
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">Lines</h2>
              <div className="space-y-2 text-sm">
                {invoice.lines.map((l) => (
                  <div key={l.id} className="flex justify-between text-slate-300">
                    <span>
                      {l.description} × {l.quantity.toString()}
                    </span>
                    <span className="text-slate-100">
                      {formatMoney(Math.round(Number(l.quantity) * l.unitPriceCents), tenant.currencyCode)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-slate-800 pt-2 font-semibold text-slate-100">
                  <span>Total</span>
                  <span>{formatMoney(invoice.totalCents, tenant.currencyCode)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
