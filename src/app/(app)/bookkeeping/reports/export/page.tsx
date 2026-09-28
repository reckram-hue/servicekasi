import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { canUse } from '@/lib/plans/plans';
import { resolvePeriod } from '@/lib/bookkeeping/period';
import { slipPhotoCount } from '@/lib/bookkeeping/export';
import { PeriodNav } from '@/components/bookkeeping/PeriodNav';

export default async function AccountantExportPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { tenant } = await requireRole();
  if (!canUse(tenant, 'accountantExport')) redirect('/bookkeeping/reports');

  const { period: periodParam } = await searchParams;
  const period = resolvePeriod(periodParam, tenant.timezone);
  const slipCount = await slipPhotoCount(tenantDb(tenant.id), period.start, period.end);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-md">
        <Link href="/bookkeeping/reports" className="text-sm text-amber-400 hover:underline">
          ← Reports
        </Link>
        <h1 className="mt-2 mb-1 text-2xl font-bold">Accountant export</h1>
        <p className="mb-6 text-sm text-slate-500">Everything recorded in your cashbook for a period, ready to hand over.</p>

        <PeriodNav basePath="/bookkeeping/reports/export" period={period} timeZone={tenant.timezone} />

        <div className="space-y-3">
          <a
            href={`/api/bookkeeping/export/journal?period=${period.key}`}
            className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4 hover:border-slate-600"
          >
            <div>
              <div className="font-medium">Journal (CSV)</div>
              <div className="text-sm text-slate-500">Every entry with account codes, ready for Excel or Sheets</div>
            </div>
            <span className="text-slate-500">⬇</span>
          </a>

          {slipCount > 0 ? (
            <a
              href={`/api/bookkeeping/export/slips?period=${period.key}`}
              className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4 hover:border-slate-600"
            >
              <div>
                <div className="font-medium">Slip photos (zip)</div>
                <div className="text-sm text-slate-500">
                  {slipCount} photo{slipCount === 1 ? '' : 's'} from expenses and bills this period
                </div>
              </div>
              <span className="text-slate-500">⬇</span>
            </a>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 opacity-70">
              <div className="font-medium">Slip photos (zip)</div>
              <div className="text-sm text-slate-500">No slip photos recorded this period.</div>
            </div>
          )}
        </div>

        <p className="mt-6 text-xs text-slate-500">
          This is a record-keeping tool, not an accounting package — the journal export is exactly what&rsquo;s in your cashbook, for your
          accountant to check and use as they see fit.
        </p>
      </div>
    </div>
  );
}
