import { localDateStr } from '@/lib/dates';

/** The UTC-midnight range covering a calendar month in the tenant's time zone, matching how Expense/JournalEntry dates are stored ("YYYY-MM-DD" as UTC midnight). */
export function currentMonthRange(timeZone: string): { start: Date; end: Date } {
  const [y, m] = localDateStr(new Date(), timeZone).split('-').map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}
