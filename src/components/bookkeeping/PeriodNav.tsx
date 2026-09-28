import Link from 'next/link';
import {
  shiftMonthKey,
  shiftBimonthKey,
  bimonthKeyFrom,
  firstMonthKeyOf,
  currentFiscalYearKey,
  periodKind,
  type ReportPeriod,
} from '@/lib/bookkeeping/period';

/**
 * Prev/next navigation shared by the P&L and VAT report pages. `allowBimonth`
 * additionally offers a "2-month period" view — a SARS VAT201 covers two
 * months, and nobody should have to open this report twice and add the
 * numbers together by hand.
 */
export function PeriodNav({
  basePath,
  period,
  timeZone,
  allowBimonth = false,
}: {
  basePath: string;
  period: ReportPeriod;
  timeZone: string;
  allowBimonth?: boolean;
}) {
  const kind = periodKind(period);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-3">
        {kind === 'fiscalYear' ? (
          <span />
        ) : (
          <Link
            href={`${basePath}?period=${kind === 'bimonth' ? shiftBimonthKey(period, -2) : shiftMonthKey(period, -1)}`}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500"
          >
            {kind === 'bimonth' ? '← Prev 2 months' : '← Prev month'}
          </Link>
        )}
        <div className="text-center font-semibold">{period.label}</div>
        {kind === 'fiscalYear' ? (
          <span />
        ) : (
          <Link
            href={`${basePath}?period=${kind === 'bimonth' ? shiftBimonthKey(period, 2) : shiftMonthKey(period, 1)}`}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500"
          >
            {kind === 'bimonth' ? 'Next 2 months →' : 'Next month →'}
          </Link>
        )}
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
        {kind === 'month' && (
          <>
            {allowBimonth && (
              <Link href={`${basePath}?period=${bimonthKeyFrom(period)}`} className="text-amber-400 hover:underline">
                Include next month (2-month VAT period)
              </Link>
            )}
            <Link href={`${basePath}?period=${currentFiscalYearKey(timeZone)}`} className="text-amber-400 hover:underline">
              View tax year
            </Link>
          </>
        )}
        {kind === 'bimonth' && (
          <Link href={`${basePath}?period=${firstMonthKeyOf(period)}`} className="text-amber-400 hover:underline">
            Back to 1 month
          </Link>
        )}
        {kind === 'fiscalYear' && (
          <Link href={basePath} className="text-amber-400 hover:underline">
            Back to months
          </Link>
        )}
      </div>
    </div>
  );
}
