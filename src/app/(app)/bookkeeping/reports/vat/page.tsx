import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { canUse } from '@/lib/plans/plans';
import { resolvePeriod } from '@/lib/bookkeeping/period';
import { vatSummary } from '@/lib/bookkeeping/reports';
import { PeriodNav } from '@/components/bookkeeping/PeriodNav';

export default async function VatSummaryPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { tenant } = await requireRole();
  if (!tenant.vatRegistered || !canUse(tenant, 'vatSummary')) redirect('/bookkeeping/reports');

  const { period: periodParam } = await searchParams;
  const period = resolvePeriod(periodParam, tenant.timezone);

  const vat = await vatSummary(tenantDb(tenant.id), tenant, period.start, period.end);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-md">
        <Link href="/bookkeeping/reports" className="text-sm text-amber-400 hover:underline">
          ← Reports
        </Link>
        <h1 className="mt-2 mb-6 text-2xl font-bold">VAT summary</h1>

        <PeriodNav basePath="/bookkeeping/reports/vat" period={period} timeZone={tenant.timezone} allowBimonth />

        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-800 p-4">
            <span className="text-sm text-slate-300">Output VAT (charged to clients)</span>
            <span className="font-mono font-semibold">{formatMoney(vat.outputVatCents, tenant.currencyCode)}</span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-800 p-4">
            <span className="text-sm text-slate-300">Input VAT (paid on expenses &amp; bills)</span>
            <span className="font-mono font-semibold">{formatMoney(vat.inputVatCents, tenant.currencyCode)}</span>
          </div>
          <div className="flex items-center justify-between p-4">
            <span className="text-sm font-medium text-slate-100">{vat.netVatCents >= 0 ? 'Payable to SARS' : 'Refundable from SARS'}</span>
            <span className={`font-mono font-bold ${vat.netVatCents >= 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {formatMoney(Math.abs(vat.netVatCents), tenant.currencyCode)}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Output VAT is the VAT share of what clients actually paid this period. Input VAT is worked out from expenses and bills marked
          &quot;Includes VAT&quot;, at your standard rate. Figures for your VAT201 — your accountant should still check them before you file.
        </p>
      </div>
    </div>
  );
}
