import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { addDaysToDateStr, dateStrDayOfWeek, localDateStr, todayDateStr, zonedDateTime } from '@/lib/dates';
import { publicHolidayName } from '@/lib/holidays';
import { topUpRecurringVisits } from '@/lib/jobs/recurring';

function displayName(c: { firstName: string; lastName: string | null; companyName: string | null }) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return c.companyName ? `${name} (${c.companyName})` : name;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ date?: string; range?: string }> }) {
  const { tenant } = await requireRole();
  const { date: dateParam, range: rangeParam } = await searchParams;

  await topUpRecurringVisits(tenant.id, tenant.timezone);

  const todayStr = todayDateStr(tenant.timezone);
  const date = dateParam && DATE_RE.test(dateParam) ? dateParam : todayStr;
  const range: 'day' | 'week' = rangeParam === 'week' ? 'week' : 'day';

  let rangeStartStr = date;
  let numDays = 1;
  if (range === 'week') {
    const dow = dateStrDayOfWeek(date); // 0 = Sunday
    rangeStartStr = addDaysToDateStr(date, dow === 0 ? -6 : 1 - dow); // Monday of this week
    numDays = 7;
  }
  const rangeEndStr = addDaysToDateStr(rangeStartStr, numDays);
  const rangeStart = zonedDateTime(rangeStartStr, '00:00');
  const rangeEnd = zonedDateTime(rangeEndStr, '00:00');

  const prevDate = addDaysToDateStr(date, range === 'week' ? -7 : -1);
  const nextDate = addDaysToDateStr(date, range === 'week' ? 7 : 1);

  const db = tenantDb(tenant.id);
  const [technicians, visits] = await Promise.all([
    db.membership.findMany({ where: { OR: [{ role: 'TECHNICIAN' }, { doesFieldwork: true }], active: true }, include: { user: true }, orderBy: { createdAt: 'asc' } }),
    db.visit.findMany({
      where: { startsAt: { gte: rangeStart, lt: rangeEnd }, status: { not: 'CANCELLED' } },
      include: { job: { include: { client: true } }, assignments: true },
      orderBy: { startsAt: 'asc' },
    }),
  ]);

  const byTech = new Map<string, typeof visits>();
  for (const t of technicians) byTech.set(t.id, []);
  const unassigned: typeof visits = [];
  for (const v of visits) {
    if (v.assignments.length === 0) unassigned.push(v);
    for (const a of v.assignments) {
      if (!byTech.has(a.membershipId)) byTech.set(a.membershipId, []);
      byTech.get(a.membershipId)!.push(v);
    }
  }

  function isDoubleBooked(list: typeof visits, index: number): boolean {
    const prev = list[index - 1];
    return !!prev && prev.endsAt > list[index].startsAt;
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-2xl font-bold">Schedule</h1>

        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href={`/schedule?date=${prevDate}&range=${range}`} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700">
              ← Prev
            </Link>
            <Link href={`/schedule?date=${todayStr}&range=${range}`} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700">
              Today
            </Link>
            <Link href={`/schedule?date=${nextDate}&range=${range}`} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700">
              Next →
            </Link>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/schedule?date=${date}&range=day`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${range === 'day' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              Day
            </Link>
            <Link
              href={`/schedule?date=${date}&range=week`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${range === 'week' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              Week
            </Link>
          </div>
        </div>

        <p className="mb-4 text-sm text-slate-400">
          {range === 'day'
            ? rangeStart.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tenant.timezone })
            : `${rangeStartStr} – ${addDaysToDateStr(rangeStartStr, 6)}`}
          {range === 'day' && publicHolidayName(tenant.countryCode, date) && (
            <span className="ml-2 text-amber-300">⚠ Public holiday: {publicHolidayName(tenant.countryCode, date)}</span>
          )}
        </p>

        {technicians.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-slate-500">
            Add a technician on the Team page to start scheduling.
          </p>
        ) : (
          <div className="space-y-4">
            {[
              ...technicians.map((t) => ({ key: t.id, name: t.user.name, list: byTech.get(t.id) ?? [] })),
              ...(unassigned.length > 0 ? [{ key: 'unassigned', name: 'Unassigned', list: unassigned }] : []),
            ].map(({ key, name, list }) => {
              return (
                <div key={key} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <div className="mb-3 font-medium text-slate-100">{name}</div>
                  {list.length === 0 ? (
                    <p className="text-sm text-slate-500">No visits.</p>
                  ) : (
                    <div className="space-y-2">
                      {list.map((v, i) => (
                        <div key={v.id} className="flex items-center justify-between rounded-lg border border-slate-800 p-3">
                          <div>
                            <div className="text-sm font-medium text-slate-100">
                              {range === 'week' &&
                                `${v.startsAt.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', timeZone: tenant.timezone })} · `}
                              {v.startsAt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: tenant.timezone })}–
                              {v.endsAt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: tenant.timezone })}
                            </div>
                            <Link href={`/jobs/${v.job.id}`} className="text-xs text-amber-400 hover:underline">
                              {v.job.number} — {v.job.title}
                              {v.occurrenceDate && ' ↻'}
                            </Link>
                            <div className="text-xs text-slate-500">{displayName(v.job.client)}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {isDoubleBooked(list, i) && (
                              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-300">Double-booked</span>
                            )}
                            {range === 'week' && publicHolidayName(tenant.countryCode, localDateStr(v.startsAt, tenant.timezone)) && (
                              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300">
                                {publicHolidayName(tenant.countryCode, localDateStr(v.startsAt, tenant.timezone))}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
