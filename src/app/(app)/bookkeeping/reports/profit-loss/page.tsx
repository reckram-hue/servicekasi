import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { resolvePeriod } from '@/lib/bookkeeping/period';
import { profitAndLoss } from '@/lib/bookkeeping/reports';
import { PeriodNav } from '@/components/bookkeeping/PeriodNav';

export default async function ProfitAndLossPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { tenant } = await requireRole();
  const { period: periodParam } = await searchParams;
  const period = resolvePeriod(periodParam, tenant.timezone);

  const pl = await profitAndLoss(tenantDb(tenant.id), period.start, period.end);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-md">
        <Link href="/bookkeeping/reports" className="text-sm text-amber-400 hover:underline">
          ← Reports
        </Link>
        <h1 className="mt-2 mb-6 text-2xl font-bold">Profit &amp; loss</h1>

        <PeriodNav basePath="/bookkeeping/reports/profit-loss" period={period} timeZone={tenant.timezone} />

        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Income</div>
            <div className="mt-1 text-xl font-bold text-emerald-400">{formatMoney(pl.incomeCents, tenant.currencyCode)}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Expenses</div>
            <div className="mt-1 text-xl font-bold">{formatMoney(pl.expenseCents, tenant.currencyCode)}</div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Net profit</div>
          <div className={`mt-1 text-2xl font-bold ${pl.netCents >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatMoney(pl.netCents, tenant.currencyCode)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 p-4">
            <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Expenses by category</h2>
          </div>
          {pl.lines.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">Nothing recorded in the cashbook for this period.</p>
          ) : (
            pl.lines.map((l) => (
              <div key={l.name} className="flex items-center justify-between border-b border-slate-800 p-4 text-sm last:border-0">
                <span className="text-slate-300">{l.name}</span>
                <span className="font-mono font-semibold">{formatMoney(l.amountCents, tenant.currencyCode)}</span>
              </div>
            ))
          )}
        </div>

        <p className="mt-6 text-xs text-slate-500">
          Income is money actually received on invoices this period. Expenses are everything recorded in your cashbook this period, paid or not —
          a bill counts the day it&rsquo;s recorded. This is a record-keeping tool, not an accounting package — your accountant still does your tax.
        </p>
      </div>
    </div>
  );
}
