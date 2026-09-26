/**
 * Recurring visits: a deliberately small subset of iCal RRULE (RFC 5545).
 *
 *   FREQ=WEEKLY;BYDAY=TU               every Tuesday
 *   FREQ=WEEKLY;INTERVAL=2;BYDAY=TU    every second Tuesday
 *   FREQ=MONTHLY;BYMONTHDAY=15         the 15th of every month
 *   FREQ=MONTHLY;BYMONTHDAY=-1         the last day of every month
 *   FREQ=MONTHLY;BYDAY=2TU             the second Tuesday of every month
 *   FREQ=MONTHLY;BYDAY=-1FR            the last Friday of every month
 *
 * Anything else is rejected rather than half-supported. Day-of-month is
 * limited to 1–28 or "last day": RFC 5545 *skips* months that lack a 29th,
 * 30th or 31st, which a pool-service client would read as a missed visit.
 *
 * All dates are "YYYY-MM-DD" business-local calendar dates, handled as whole
 * day numbers (days since 1970-01-01) — never local-time Date objects — so
 * the results can't shift with the server's time zone or month lengths.
 *
 * Deliberately has no imports so the plain-node test script can load it.
 */

export type RecurrencePattern = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY_DATE' | 'MONTHLY_WEEKDAY';

export type ParsedRule =
  | { freq: 'WEEKLY'; interval: number; weekday: number }
  | { freq: 'MONTHLY'; monthDay: number }
  | { freq: 'MONTHLY'; nth: number; weekday: number };

/** Index = weekday, Monday = 0 (RFC 5545's default week start). */
const DAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ORDINALS = ['', '1st', '2nd', '3rd', '4th'];
const MAX_SPAN_DAYS = 3660; // guards against runaway loops from bad input

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateStr(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  return fromDayNumber(toDayNumber(s)) === s; // rejects 2026-02-30 etc.
}

function toDayNumber(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

function fromDayNumber(n: number): string {
  return new Date(n * 86_400_000).toISOString().slice(0, 10);
}

/** Monday = 0 … Sunday = 6. Day 0 (1970-01-01) was a Thursday. */
function weekdayOf(n: number): number {
  return (((n + 3) % 7) + 7) % 7;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseRule(rule: string): ParsedRule | null {
  const parts = new Map<string, string>();
  for (const part of rule.split(';')) {
    const [key, value, extra] = part.split('=');
    if (!key || value === undefined || extra !== undefined || parts.has(key)) return null;
    parts.set(key, value);
  }
  const allowed = new Set(['FREQ', 'INTERVAL', 'BYDAY', 'BYMONTHDAY']);
  for (const key of parts.keys()) if (!allowed.has(key)) return null;

  const freq = parts.get('FREQ');
  const byDay = parts.get('BYDAY');
  const byMonthDay = parts.get('BYMONTHDAY');

  if (freq === 'WEEKLY') {
    const interval = parts.has('INTERVAL') ? Number(parts.get('INTERVAL')) : 1;
    const weekday = DAY_CODES.indexOf(byDay ?? '');
    if (byMonthDay !== undefined || weekday < 0 || !Number.isInteger(interval) || interval < 1 || interval > 4) return null;
    return { freq, interval, weekday };
  }

  if (freq === 'MONTHLY') {
    if (parts.has('INTERVAL') && parts.get('INTERVAL') !== '1') return null;
    if ((byDay === undefined) === (byMonthDay === undefined)) return null; // exactly one of them
    if (byMonthDay !== undefined) {
      const monthDay = Number(byMonthDay);
      if (!/^-?\d+$/.test(byMonthDay) || !(monthDay === -1 || (monthDay >= 1 && monthDay <= 28))) return null;
      return { freq, monthDay };
    }
    const m = /^(-1|[1-4])(MO|TU|WE|TH|FR|SA|SU)$/.exec(byDay!);
    if (!m) return null;
    return { freq, nth: Number(m[1]), weekday: DAY_CODES.indexOf(m[2]) };
  }

  return null;
}

/** Builds the rule for a pattern, taking the day/weekday from the first visit date. */
export function buildRule(pattern: RecurrencePattern, firstDate: string): { rule: string } | { error: string } {
  if (!isValidDateStr(firstDate)) return { error: 'Choose a valid first visit date.' };
  const n = toDayNumber(firstDate);
  const code = DAY_CODES[weekdayOf(n)];
  const [y, m, d] = firstDate.split('-').map(Number);

  switch (pattern) {
    case 'WEEKLY':
      return { rule: `FREQ=WEEKLY;BYDAY=${code}` };
    case 'FORTNIGHTLY':
      return { rule: `FREQ=WEEKLY;INTERVAL=2;BYDAY=${code}` };
    case 'MONTHLY_DATE':
      if (d <= 28) return { rule: `FREQ=MONTHLY;BYMONTHDAY=${d}` };
      if (d === daysInMonth(y, m)) return { rule: 'FREQ=MONTHLY;BYMONTHDAY=-1' };
      return { error: 'Monthly visits need a date from the 1st to the 28th, or the last day of the month — not every month has a 29th, 30th or 31st.' };
    case 'MONTHLY_WEEKDAY': {
      const nth = Math.ceil(d / 7);
      return { rule: `FREQ=MONTHLY;BYDAY=${nth === 5 ? -1 : nth}${code}` };
    }
  }
}

/** Which form choice produced a rule (the inverse of buildRule), or null if it isn't one we offer. */
export function patternOf(rule: string): RecurrencePattern | null {
  const p = parseRule(rule);
  if (!p) return null;
  if (p.freq === 'WEEKLY') return p.interval === 1 ? 'WEEKLY' : p.interval === 2 ? 'FORTNIGHTLY' : null;
  return 'monthDay' in p ? 'MONTHLY_DATE' : 'MONTHLY_WEEKDAY';
}

/** Plain-English summary, e.g. "Every 2 weeks on Tuesday". */
export function describeRule(rule: string): string {
  const p = parseRule(rule);
  if (!p) return 'Unsupported repeat rule';
  if (p.freq === 'WEEKLY') {
    return p.interval === 1 ? `Every week on ${DAY_NAMES[p.weekday]}` : `Every ${p.interval} weeks on ${DAY_NAMES[p.weekday]}`;
  }
  if ('monthDay' in p) return p.monthDay === -1 ? 'Monthly on the last day' : `Monthly on the ${ordinalDay(p.monthDay)}`;
  return `Monthly on the ${p.nth === -1 ? 'last' : ORDINALS[p.nth]} ${DAY_NAMES[p.weekday]}`;
}

function ordinalDay(d: number): string {
  if (d >= 11 && d <= 13) return `${d}th`;
  return `${d}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[d % 10] ?? 'th'}`;
}

/**
 * Every date the rule produces within [from, to] (inclusive), never before
 * `start` (the series' first date, RFC 5545's DTSTART). Weekly intervals are
 * counted in whole weeks from the Monday of `start`'s week, so a fortnightly
 * series keeps its rhythm no matter which `from` it is asked about.
 */
export function occurrences(rule: string, start: string, from: string, to: string): string[] {
  const p = parseRule(rule);
  if (!p || !isValidDateStr(start) || !isValidDateStr(from) || !isValidDateStr(to)) return [];

  const startN = toDayNumber(start);
  const lo = Math.max(startN, toDayNumber(from));
  const hi = toDayNumber(to);
  if (hi < lo || hi - lo > MAX_SPAN_DAYS) return [];

  const out: string[] = [];

  if (p.freq === 'WEEKLY') {
    const seriesMonday = startN - weekdayOf(startN);
    let n = lo + ((p.weekday - weekdayOf(lo) + 7) % 7);
    for (; n <= hi; n += 7) {
      if (Math.floor((n - seriesMonday) / 7) % p.interval === 0) out.push(fromDayNumber(n));
    }
    return out;
  }

  let [y, m] = fromDayNumber(lo).split('-').map(Number);
  for (;;) {
    const firstOfMonth = toDayNumber(`${y}-${String(m).padStart(2, '0')}-01`);
    if (firstOfMonth > hi) break;
    const last = firstOfMonth + daysInMonth(y, m) - 1;

    let n: number;
    if ('monthDay' in p) {
      n = p.monthDay === -1 ? last : firstOfMonth + p.monthDay - 1;
    } else if (p.nth === -1) {
      n = last - ((weekdayOf(last) - p.weekday + 7) % 7);
    } else {
      n = firstOfMonth + ((p.weekday - weekdayOf(firstOfMonth) + 7) % 7) + (p.nth - 1) * 7;
    }
    if (n >= lo && n <= hi) out.push(fromDayNumber(n));

    if (m === 12) {
      y++;
      m = 1;
    } else {
      m++;
    }
  }
  return out;
}
