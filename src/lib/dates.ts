/** Today plus N days, as "YYYY-MM-DD" for a date input's defaultValue/value. */
export function isoDateDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * "Valid until 26 October" means valid for all of the 26th. The date is stored
 * as UTC midnight, so it only lapses a full day later (02:00 SAST on the 27th).
 */
export function isValidUntilPassed(validUntil: Date | null): boolean {
  return validUntil ? validUntil.getTime() + 86_400_000 <= Date.now() : false;
}

/**
 * Combines a "YYYY-MM-DD" date input and "HH:mm" time input into a Date,
 * treating them as South African Standard Time (UTC+2, no daylight saving).
 * Every currently supported market (ZA, BW, ZM, NA, MZ) shares this fixed
 * offset, so this avoids pulling in a timezone library until that stops
 * being true.
 */
export function zonedDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+02:00`);
}

/** "YYYY-MM-DD" N days after another "YYYY-MM-DD", using calendar-date math (no timezone involved). */
export function addDaysToDateStr(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 0 (Sunday) – 6 (Saturday) for a "YYYY-MM-DD" calendar date. */
export function dateStrDayOfWeek(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
