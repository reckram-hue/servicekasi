import Link from 'next/link';
import { headers } from 'next/headers';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { overdueInvoiceList, overdueBucket } from '@/lib/invoices/overdue';
import { SendReminderButton } from '@/components/invoices/SendReminderButton';

function displayName(c: { firstName: string; lastName: string | null; companyName: string | null }) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return c.companyName ? `${name} (${c.companyName})` : name;
}

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const protocol = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

export default async function OverdueInvoicesPage() {
  const { tenant } = await requireRole();
  const db = tenantDb(tenant.id);
  const [invoices, origin] = await Promise.all([overdueInvoiceList(db), siteOrigin()]);
  const businessName = tenant.tradingName || tenant.businessName;

  const buckets: { label: string; rows: typeof invoices }[] = [
    { label: '0–30 days', rows: [] },
    { label: '31–60 days', rows: [] },
    { label: '60+ days', rows: [] },
  ];
  for (const inv of invoices) {
    buckets.find((b) => b.label === overdueBucket(inv.daysOverdue))!.rows.push(inv);
  }
  const totalOverdueCents = invoices.reduce((sum, inv) => sum + inv.balanceCents, 0);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-amber-400 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 mb-1 text-2xl font-bold">Overdue invoices — {tenant.businessName}</h1>
        <p className="mb-6 text-sm text-slate-400">
          {invoices.length === 0
            ? 'Nothing overdue right now.'
            : `${invoices.length} invoice${invoices.length === 1 ? '' : 's'} overdue, totalling ${formatMoney(totalOverdueCents, tenant.currencyCode)}.`}
        </p>

        {buckets.map(
          (bucket) =>
            bucket.rows.length > 0 && (
              <div key={bucket.label} className="mb-6">
                <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">{bucket.label}</h2>
                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                  {bucket.rows.map((inv) => {
                    const publicUrl = `${origin}/i/${inv.publicToken}`;
                    const dueText = inv.dueAt!.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'UTC' });
                    const message = `Hi ${inv.client.firstName}, a reminder that invoice ${inv.number} from ${businessName} for ${formatMoney(inv.balanceCents, inv.currencyCode)} was due ${dueText} and is now ${inv.daysOverdue} day${inv.daysOverdue === 1 ? '' : 's'} overdue. Pay here: ${publicUrl}`;

                    return (
                      <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4 last:border-0">
                        <div>
                          <div className="font-medium text-slate-100">
                            <Link href={`/invoices/${inv.id}`} className="hover:underline">
                              {inv.number} — {displayName(inv.client)}
                            </Link>
                          </div>
                          <div className="text-xs text-slate-400">
                            {formatMoney(inv.balanceCents, inv.currencyCode)} due · due {dueText} · {inv.daysOverdue} day
                            {inv.daysOverdue === 1 ? '' : 's'} overdue
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <SendReminderButton clientPhone={inv.client.phone} message={message} />
                          <Link href={`/invoices/${inv.id}`} className="rounded-md bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700">
                            Open
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
        )}
      </div>
    </div>
  );
}
