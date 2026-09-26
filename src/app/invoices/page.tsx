import Link from 'next/link';
import { InvoiceStatus } from '@prisma/client';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { deleteInvoiceAction } from '@/lib/invoices/actions';
import { invoiceBadge, isInvoiceOverdue } from '@/lib/invoices/status';

const STATUS_TABS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Unpaid' },
  { value: 'PARTIALLY_PAID', label: 'Part-paid' },
  { value: 'PAID', label: 'Paid' },
  { value: 'VOID', label: 'Void' },
  { value: 'CREDIT_NOTE', label: 'Credit notes' },
];

function displayName(c: { firstName: string; lastName: string | null; companyName: string | null }) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return c.companyName ? `${name} (${c.companyName})` : name;
}

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { tenant } = await requireRole();
  const { status } = await searchParams;
  const statusFilter = status && status in InvoiceStatus ? (status as InvoiceStatus) : undefined;

  const db = tenantDb(tenant.id);
  const [invoices, clients] = await Promise.all([
    db.invoice.findMany({
      where:
        status === 'CREDIT_NOTE'
          ? { kind: 'CREDIT_NOTE' }
          : statusFilter
            ? { status: statusFilter, kind: { not: 'CREDIT_NOTE' } }
            : undefined,
      include: { client: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    db.client.findMany({ where: { archived: false }, orderBy: { firstName: 'asc' }, take: 500 }),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-amber-400 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 mb-6 text-2xl font-bold">Invoices — {tenant.businessName}</h1>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={tab.value ? `/invoices?status=${tab.value}` : '/invoices'}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  (status ?? '') === tab.value ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          {clients.length > 0 && (
            <form action="/invoices/new" method="GET" className="flex items-center gap-2">
              <select
                name="client"
                required
                defaultValue=""
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none"
              >
                <option value="" disabled>
                  Choose a client…
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {displayName(c)}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400">
                + New invoice
              </button>
            </form>
          )}
        </div>

        {invoices.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-slate-500">
            {status ? 'No invoices with this status.' : 'No invoices yet. Pick a client above, or create one from a job.'}
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4 last:border-0">
                <div>
                  <div className="font-medium text-slate-100">
                    <Link href={`/invoices/${inv.id}`} className="hover:underline">
                      {inv.number ?? 'Draft'} — {displayName(inv.client)}
                    </Link>
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatMoney(inv.totalCents, tenant.currencyCode)}
                    {inv.dueAt && inv.status !== 'DRAFT' && inv.status !== 'PAID' && inv.status !== 'VOID' && (
                      <> · due {inv.dueAt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isInvoiceOverdue(inv) && (
                    <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300">Overdue</span>
                  )}
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${invoiceBadge(inv).style}`}>{invoiceBadge(inv).label}</span>
                  <Link href={`/invoices/${inv.id}`} className="rounded-md bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700">
                    Open
                  </Link>
                  {inv.status === 'DRAFT' && (
                    <form action={deleteInvoiceAction}>
                      <input type="hidden" name="id" value={inv.id} />
                      <button type="submit" className="rounded-md bg-slate-800 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10">
                        Delete
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
