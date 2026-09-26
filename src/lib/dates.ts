/** Today plus N days, as "YYYY-MM-DD" for a date input's defaultValue/value. */
export function isoDateDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}
