import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { formatDateStr, localDateStr, todayDateStr } from '@/lib/dates';
import { canUse } from '@/lib/plans/plans';
import { debtorsAgedReport, AGED_BUCKET_LABEL, type AgedBucketKey } from '@/lib/bookkeeping/reports';

const BUCKET_ORDER: AgedBucketKey[] = ['current', 'd30', 'd60', 'd90', 'd90plus'];

export default async function DebtorsAgedPage() {
  const { tenant } = await requireRole();
  if (!canUse(tenant, 'debtorsAged')) redirect('/bookkeeping/reports');

  const asOf = new Date(`${todayDateStr(tenant.timezone)}T00:00:00Z`);
  const report = await debtorsAgedReport(tenantDb(tenant.id), asOf);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-md">
        <Link href="/bookkeeping/reports" className="text-sm text-amber-400 hover:underline">
          ← Reports
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Debtors aged</h1>
        <p className="mb-6 text-sm text-slate-500">As of {formatDateStr(localDateStr(asOf, 'UTC'))}</p>

        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900">
          {BUCKET_ORDER.map((key) => (
            <div key={key} className="flex items-center justify-between border-b border-slate-800 p-4 text-sm last:border-0">
              <span className="text-slate-300">{AGED_BUCKET_LABEL[key]}</span>
              <span className="font-mono font-semibold">{formatMoney(report.buckets[key].totalCents, tenant.currencyCode)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between p-4">
            <span className="font-medium text-slate-100">Total owed to you</span>
            <span className="font-mono font-bold">{formatMoney(report.totalCents, tenant.currencyCode)}</span>
          </div>
        </div>

        {report.totalCents === 0 ? (
          <p className="text-sm text-slate-400">Nothing outstanding right now.</p>
        ) : (
          BUCKET_ORDER.filter((key) => report.buckets[key].invoices.length > 0).map((key) => (
            <div key={key} className="mb-6 rounded-2xl border border-slate-800 bg-slate-900">
              <div className="border-b border-slate-800 p-4">
                <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">{AGED_BUCKET_LABEL[key]}</h2>
              </div>
              {report.buckets[key].invoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="flex items-center justify-between gap-3 border-b border-slate-800 p-4 last:border-0 hover:bg-slate-800/40"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {inv.number ?? 'Draft'} — {inv.clientName}
                    </div>
                    <div className="text-xs text-slate-500">
                      Due {formatDateStr(localDateStr(inv.dueDate, 'UTC'))}
                      {inv.daysOverdue > 0 && ` · ${inv.daysOverdue} day${inv.daysOverdue === 1 ? '' : 's'} overdue`}
                    </div>
                  </div>
                  <div className="font-mono font-semibold">{formatMoney(inv.balanceCents, tenant.currencyCode)}</div>
                </Link>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
