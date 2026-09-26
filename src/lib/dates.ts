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
