import { localDateStr } from '@/lib/dates';

export type ReportPeriod = { start: Date; end: Date; label: string; key: string };

function monthPeriod(year: number, month1: number): ReportPeriod {
  const start = new Date(Date.UTC(year, month1 - 1, 1));
  const end = new Date(Date.UTC(year, month1, 1));
  const label = start.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return { start, end, label, key: `${year}-${String(month1).padStart(2, '0')}` };
}

/** South Africa's tax year runs 1 March – end of February, named by the year it ends in. */
function fiscalYearPeriod(endYear: number): ReportPeriod {
  const start = new Date(Date.UTC(endYear - 1, 2, 1)); // 1 March
  const end = new Date(Date.UTC(endYear, 2, 1)); // 1 March the following year
  return { start, end, label: `Tax year ${endYear} (Mar ${endYear - 1} – Feb ${endYear})`, key: `fy${endYear}` };
}

/** Parses a "?period=" value like "2026-09" or "fy2027" into a date range. Falls back to the current month. */
export function resolvePeriod(raw: string | undefined, timeZone: string): ReportPeriod {
  if (raw && /^fy\d{4}$/.test(raw)) return fiscalYearPeriod(Number(raw.slice(2)));
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split('-').map(Number);
    return monthPeriod(y, m);
  }
  const [y, m] = localDateStr(new Date(), timeZone).split('-').map(Number);
  return monthPeriod(y, m);
}

/** The "?period=" value for one calendar month before/after this one. Only meaningful when the period is a month. */
export function shiftMonthKey(period: ReportPeriod, delta: number): string {
  const d = new Date(period.start);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** The current SA tax year's "?period=" key — Jan/Feb belong to the tax year ending that same year. */
export function currentFiscalYearKey(timeZone: string): string {
  const [y, m] = localDateStr(new Date(), timeZone).split('-').map(Number);
  return `fy${m >= 3 ? y + 1 : y}`;
}
