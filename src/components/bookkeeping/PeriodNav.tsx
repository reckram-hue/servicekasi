import Link from 'next/link';
import { shiftMonthKey, currentFiscalYearKey, type ReportPeriod } from '@/lib/bookkeeping/period';

/** Prev/next month plus a "tax year" toggle, shared by the P&L and VAT report pages. */
export function PeriodNav({ basePath, period, timeZone }: { basePath: string; period: ReportPeriod; timeZone: string }) {
  const isFiscalYear = period.key.startsWith('fy');

  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      {isFiscalYear ? (
        <span />
      ) : (
        <Link href={`${basePath}?period=${shiftMonthKey(period, -1)}`} className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500">
          ← Prev month
        </Link>
      )}
      <div className="text-center">
        <div className="font-semibold">{period.label}</div>
        {isFiscalYear ? (
          <Link href={basePath} className="text-xs text-amber-400 hover:underline">
            Back to months
          </Link>
        ) : (
          <Link href={`${basePath}?period=${currentFiscalYearKey(timeZone)}`} className="text-xs text-amber-400 hover:underline">
            View tax year
          </Link>
        )}
      </div>
      {isFiscalYear ? (
        <span />
      ) : (
        <Link href={`${basePath}?period=${shiftMonthKey(period, 1)}`} className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500">
          Next month →
        </Link>
      )}
    </div>
  );
}
