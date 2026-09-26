/**
 * South African public holidays (Public Holidays Act 36 of 1994), computed
 * rather than hard-coded so it never goes stale.
 *
 * Dates are plain "YYYY-MM-DD" calendar strings — no Date objects in local
 * time — so the answer never depends on the server's time zone.
 *
 * Not included: one-off days the President proclaims (election days, or
 * 27 Dec 2022 when Christmas fell on a Sunday). Holiday flags are advisory —
 * visits are still created, the owner decides whether to move them.
 *
 * Deliberately has no imports so the plain-node test script can load it.
 */

const FIXED: [month: number, day: number, name: string][] = [
  [1, 1, "New Year's Day"],
  [3, 21, 'Human Rights Day'],
  [4, 27, 'Freedom Day'],
  [5, 1, "Workers' Day"],
  [6, 16, 'Youth Day'],
  [8, 9, "National Women's Day"],
  [9, 24, 'Heritage Day'],
  [12, 16, 'Day of Reconciliation'],
  [12, 25, 'Christmas Day'],
  [12, 26, 'Day of Goodwill'],
];

function ymd(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

/** Easter Sunday (Gregorian), via the anonymous Gregorian ("Meeus/Jones/Butcher") algorithm. */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(year, month, day);
}

const cache = new Map<number, Map<string, string>>();

export function saPublicHolidays(year: number): Map<string, string> {
  const cached = cache.get(year);
  if (cached) return cached;

  const days = new Map<string, string>();
  const [ey, em, ed] = easterSunday(year).split('-').map(Number);
  days.set(ymd(ey, em, ed - 2), 'Good Friday');
  days.set(ymd(ey, em, ed + 1), 'Family Day');
  for (const [month, day, name] of FIXED) days.set(ymd(year, month, day), name);

  // Section 2(1): a public holiday falling on a Sunday makes the following
  // Monday a public holiday too (unless that Monday already is one).
  for (const [month, day, name] of FIXED) {
    if (new Date(Date.UTC(year, month - 1, day)).getUTCDay() !== 0) continue;
    const monday = ymd(year, month, day + 1);
    if (!days.has(monday)) days.set(monday, `${name} (observed)`);
  }

  cache.set(year, days);
  return days;
}

/** The holiday's name if `date` ("YYYY-MM-DD") is a public holiday in this country, else null. Only South Africa is known so far. */
export function publicHolidayName(countryCode: string, date: string): string | null {
  if (countryCode !== 'ZA' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return saPublicHolidays(Number(date.slice(0, 4))).get(date) ?? null;
}
