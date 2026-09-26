import { tenantDb } from '@/lib/db';
import { addDaysToDateStr, todayDateStr, zonedDateTime } from '@/lib/dates';
import { topUpRecurringVisits } from '@/lib/jobs/recurring';
import { arriveAction, completeVisitAction, markNoAccessAction, startTravelAction } from '@/lib/jobs/actions';

function displayName(c: { firstName: string; lastName: string | null; companyName: string | null }) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return c.companyName ? `${name} (${c.companyName})` : name;
}

function propertyLabel(p: { street: string; suburb: string | null; city: string }) {
  return [p.street, p.suburb, p.city].filter(Boolean).join(', ');
}

function mapsLink(p: { street: string; suburb: string | null; city: string }) {
  const query = [p.street, p.suburb, p.city, 'South Africa'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  EN_ROUTE: 'On my way',
  ON_SITE: 'On site',
  COMPLETED: 'Done',
  CANCELLED: 'Cancelled',
  NO_ACCESS: 'No access',
};

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-slate-800 text-slate-300',
  EN_ROUTE: 'bg-blue-500/10 text-blue-300',
  ON_SITE: 'bg-amber-500/10 text-amber-300',
  COMPLETED: 'bg-emerald-500/10 text-emerald-300',
  CANCELLED: 'bg-slate-800 text-slate-500',
  NO_ACCESS: 'bg-red-500/10 text-red-300',
};

const BIG_BUTTON = 'flex-1 rounded-xl px-4 py-4 text-center text-base font-semibold active:opacity-80';

function formatTimeRange(start: Date, end: Date, timezone: string) {
  const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', timeZone: timezone };
  return `${start.toLocaleTimeString('en-ZA', opts)}–${end.toLocaleTimeString('en-ZA', opts)}`;
}

export async function TechnicianDay({
  tenant,
  membershipId,
}: {
  tenant: { id: string; timezone: string };
  membershipId: string;
}) {
  await topUpRecurringVisits(tenant.id, tenant.timezone);

  const todayStr = todayDateStr(tenant.timezone);
  const tomorrowStr = addDaysToDateStr(todayStr, 1);
  const dayAfterStr = addDaysToDateStr(todayStr, 2);

  const db = tenantDb(tenant.id);
  const visits = await db.visit.findMany({
    where: {
      startsAt: { gte: zonedDateTime(todayStr, '00:00'), lt: zonedDateTime(dayAfterStr, '00:00') },
      status: { not: 'CANCELLED' },
      assignments: { some: { membershipId } },
    },
    include: { job: { include: { client: true, property: true } } },
    orderBy: { startsAt: 'asc' },
  });

  const tomorrowStart = zonedDateTime(tomorrowStr, '00:00');
  const todaysVisits = visits.filter((v) => v.startsAt < tomorrowStart);
  const tomorrowsVisits = visits.filter((v) => v.startsAt >= tomorrowStart);

  function VisitCard({ v }: { v: (typeof visits)[number] }) {
    const client = v.job.client;
    const property = v.job.property;

    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-400">{formatTimeRange(v.startsAt, v.endsAt, tenant.timezone)}</span>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[v.status] ?? 'bg-slate-800 text-slate-300'}`}>
            {STATUS_LABELS[v.status] ?? v.status}
          </span>
        </div>

        <h3 className="text-lg font-semibold text-slate-100">{v.job.title}</h3>
        <p className="text-sm text-slate-400">{displayName(client)}</p>
        {property && <p className="mt-1 text-sm text-slate-300">{propertyLabel(property)}</p>}
        {property?.accessNotes && <p className="mt-1 text-sm text-amber-300">⚠ {property.accessNotes}</p>}
        {v.instructions && <p className="mt-2 text-sm text-slate-400">{v.instructions}</p>}

        <div className="mt-4 flex gap-2">
          {client.phone && (
            <a href={`tel:${client.phone}`} className={`${BIG_BUTTON} bg-slate-800 text-slate-100`}>
              📞 Call
            </a>
          )}
          {property && (
            <a href={mapsLink(property)} target="_blank" rel="noopener noreferrer" className={`${BIG_BUTTON} bg-slate-800 text-slate-100`}>
              🧭 Navigate
            </a>
          )}
        </div>

        {(v.status === 'SCHEDULED' || v.status === 'EN_ROUTE') && (
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex gap-2">
              {v.status === 'SCHEDULED' && (
                <form action={startTravelAction} className="flex-1">
                  <input type="hidden" name="visitId" value={v.id} />
                  <button type="submit" className={`${BIG_BUTTON} bg-blue-500 text-white`}>
                    On my way
                  </button>
                </form>
              )}
              <form action={arriveAction} className="flex-1">
                <input type="hidden" name="visitId" value={v.id} />
                <button type="submit" className={`${BIG_BUTTON} bg-amber-500 text-slate-950`}>
                  Arrived
                </button>
              </form>
            </div>
            <form action={markNoAccessAction}>
              <input type="hidden" name="visitId" value={v.id} />
              <input type="text" name="notes" placeholder="Why? (optional)" maxLength={2000} className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none" />
              <button type="submit" className="w-full rounded-xl border border-red-900 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 active:opacity-80">
                No access
              </button>
            </form>
          </div>
        )}

        {v.status === 'ON_SITE' && (
          <form action={completeVisitAction} className="mt-3">
            <input type="hidden" name="visitId" value={v.id} />
            <textarea
              name="notes"
              rows={2}
              placeholder="Notes for this job (optional)"
              maxLength={2000}
              className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none"
            />
            <button type="submit" className={`${BIG_BUTTON} w-full bg-emerald-500 text-slate-950`}>
              Done
            </button>
          </form>
        )}

        {(v.status === 'COMPLETED' || v.status === 'NO_ACCESS') && v.completionNotes && (
          <p className="mt-3 rounded-lg bg-slate-800/50 px-3 py-2 text-sm text-slate-400">{v.completionNotes}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">Today</h2>
        {todaysVisits.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">No visits today.</p>
        ) : (
          <div className="space-y-3">
            {todaysVisits.map((v) => (
              <VisitCard key={v.id} v={v} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">Tomorrow</h2>
        {tomorrowsVisits.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">No visits scheduled yet.</p>
        ) : (
          <div className="space-y-3">
            {tomorrowsVisits.map((v) => (
              <VisitCard key={v.id} v={v} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
